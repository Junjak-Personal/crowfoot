import { ArrowDown, IconButton } from '@liam-hq/ui'
import type { FC } from 'react'
import styles from './ScrollToBottomButton.module.css'

type Props = {
  visible: boolean
  onClick: () => void
}

export const ScrollToBottomButton: FC<Props> = ({ visible, onClick }) => {
  return (
    <div
      className={styles.root}
      data-visible={visible ? 'true' : 'false'}
      aria-hidden={!visible}
    >
      <IconButton
        icon={<ArrowDown />}
        tooltipSide="top"
        tooltipContent="Scroll to bottom"
        className={styles.button}
        onClick={onClick}
      />
    </div>
  )
}
