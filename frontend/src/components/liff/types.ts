import type { CSSProperties } from 'react'

export interface LiffTheme {
	card: string
	header: string
	title: string
	buttonPrimary: string
	buttonSecondary: string
	iconColor: string
	cardStyle?: CSSProperties
	headerStyle?: CSSProperties
	titleStyle?: CSSProperties
	primaryStyle?: CSSProperties
}
