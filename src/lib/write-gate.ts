import { create } from 'zustand'

/**
 * 写博文权限门禁（前端部分）
 *
 * 所有写操作（发布/编辑/删除/保存配置）最终都会调 getAuthToken()，
 * 在那里统一走 requireWriteApproval()：先问服务端 cookie 是否已解锁，
 * 未解锁则弹出密码框。口令校验与 12h 会话都在服务端 /api/write-auth。
 */

interface WriteGateState {
	/** 是否已通过服务端校验并获得有效会话 */
	authorized: boolean
	/** 上次校验时间戳 */
	lastChecked: number
	/** 是否正在加载 */
	loading: boolean
	/** 弹窗是否打开 */
	dialogOpen: boolean
	/** 当前弹窗提示文案 */
	dialogMessage: string
	/** 弹窗 resolve 回调（未解锁时挂起写操作） */
	pendingResolve: ((value: boolean) => void) | null

	setAuthorized: (v: boolean) => void
	setLoading: (v: boolean) => void
	openDialog: (message: string) => Promise<boolean>
	closeDialog: () => void
}

export const useWriteGateStore = create<WriteGateState>((set, get) => ({
	authorized: false,
	lastChecked: 0,
	loading: false,
	dialogOpen: false,
	dialogMessage: '',
	pendingResolve: null,

	setAuthorized: (v) => set({ authorized: v, lastChecked: Date.now() }),
	setLoading: (v) => set({ loading: v }),

	openDialog: (message) => {
		return new Promise<boolean>((resolve) => {
			set({ dialogOpen: true, dialogMessage: message, pendingResolve: resolve })
		})
	},

	closeDialog: () => {
		const resolve = get().pendingResolve
		set({ dialogOpen: false, pendingResolve: null })
		// 如果关了弹窗但没触发提交，视为拒绝
		if (resolve) resolve(false)
	},
}))

/**
 * 写操作前置门禁检查。
 * 1. 先 GET /api/write-auth 确认服务端会话是否有效
 * 2. 有效则直接放行
 * 3. 无效则弹出密码框，用户提交后 POST /api/write-auth 校验
 * 4. 校验成功 → 放行；失败 → 提示重试 / 拒绝
 *
 * @param message 弹窗提示文案，如"进行写操作前需要验证身份"
 * @returns true 已解锁，false 拒绝 / 出错
 */
export async function requireWriteApproval(message = '验证身份'): Promise<boolean> {
	const store = useWriteGateStore.getState()

	// 如果已授权且 5 分钟内校验过，直接放行
	if (store.authorized && Date.now() - store.lastChecked < 5 * 60 * 1000) {
		return true
	}

	// 向服务端确认会话是否有效
	try {
		const res = await fetch('/api/write-auth')
		const data = (await res.json()) as { ok: boolean }
		if (data.ok) {
			useWriteGateStore.getState().setAuthorized(true)
			return true
		}
	} catch {
		// 网络错误，降级弹窗
	}

	// 服务端无有效会话 → 弹密码框
	const approved = await store.openDialog(message)
	return approved
}