'use client'

import { useState } from 'react'

interface Props {
	src: string
	title: string
}

export function SourceIframe({ src, title }: Props) {
	const [loaded, setLoaded] = useState(false)

	return (
		<div className="relative w-full h-[72vh] bg-paper">
			{!loaded && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper">
					<div className="flex gap-1.5">
						<span className="w-1.5 h-1.5 bg-amber/70 animate-pulse" style={{ animationDelay: '0ms' }} />
						<span className="w-1.5 h-1.5 bg-amber/50 animate-pulse" style={{ animationDelay: '150ms' }} />
						<span className="w-1.5 h-1.5 bg-amber/30 animate-pulse" style={{ animationDelay: '300ms' }} />
					</div>
					<span className="text-[11px] uppercase tracking-[0.3em] text-faint">Loading source</span>
				</div>
			)}
			<iframe
				src={src}
				title={title}
				onLoad={() => setLoaded(true)}
				className={`w-full h-full bg-white transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
				referrerPolicy="no-referrer"
			/>
		</div>
	)
}
