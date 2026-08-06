import type { FC } from 'react'
import styles from './WorkflowRunningIndicator.module.css'

type Props = {
  size?: number
}

export const WorkflowRunningIndicator: FC<Props> = ({ size = 8 }) => {
  const dotStyle = {
    width: `${size}px`,
    height: `${size}px`,
  }

  return (
    <div className={styles.wrapper} style={{ gap: `${size / 2}px` }}>
      <div className={styles.dot} style={dotStyle} />
      <div className={styles.dot} style={dotStyle} />
      <div className={styles.dot} style={dotStyle} />
    </div>
  )
}
