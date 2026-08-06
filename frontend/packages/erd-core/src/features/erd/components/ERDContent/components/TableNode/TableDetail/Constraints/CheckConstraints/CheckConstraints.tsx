import type { CheckConstraint } from '@crowfoot/schema'
import { Check } from '@crowfoot/ui'
import type { FC } from 'react'
import styles from '../Constraints.module.css'
import { CheckConstraintsItem } from './CheckConstraintsItem'

type Props = {
  tableId: string
  constraints: CheckConstraint[]
}

export const CheckConstraints: FC<Props> = ({ tableId, constraints }) => {
  return (
    <div className={styles.itemWrapper}>
      <h3 className={styles.sectionTitle}>
        <Check className={styles.constraintsIcon} />
        Check
      </h3>
      {constraints.map((constraint) => (
        <CheckConstraintsItem
          key={constraint.name}
          tableId={tableId}
          checkConstraint={constraint}
        />
      ))}
    </div>
  )
}
