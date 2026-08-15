import { NextResponse } from 'next/server'
import blogIndex from '@/../public/blogs/index.json'

export async function GET() {
	return NextResponse.json(blogIndex, {
		headers: {
			'Cache-Control': 'no-store, max-age=0'
		}
	})
}
