export interface NoticeValue {
    tone: 'success' | 'pending' | 'error' | 'loading'
    title: string
    message: string
}

export default function Notice({ tone, title, message }: NoticeValue) {
    return <div className={`tm-notice tm-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
        <strong>{title}</strong>
        <p>{message}</p>
    </div>
}
