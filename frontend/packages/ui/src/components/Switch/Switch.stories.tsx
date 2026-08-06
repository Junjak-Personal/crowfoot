import type { Meta, StoryObj } from '@storybook/nextjs'
import { useId, useState } from 'react'
import { SwitchRoot, SwitchThumb } from './Switch'

const SwitchExample = () => {
  const [checked, setChecked] = useState(false)
  const switchId = useId()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label htmlFor={switchId}>Airplane mode</label>
      <SwitchRoot
        id={switchId}
        checked={checked}
        onCheckedChange={setChecked}
        aria-label="Airplane mode"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          width: 36,
          height: 20,
          borderRadius: 9999,
          backgroundColor: checked
            ? 'var(--primary-accent)'
            : 'var(--overlay-20)',
          border: `1px solid ${checked ? 'var(--primary-accent)' : 'var(--pane-border)'}`,
          cursor: 'pointer',
          transition:
            'background-color 150ms var(--default-timing-function), border-color 150ms var(--default-timing-function)',
        }}
      >
        <SwitchThumb
          style={{
            width: 14,
            height: 14,
            backgroundColor: 'var(--color-white-alpha-100)',
            borderRadius: 9999,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
            transform: checked ? 'translateX(18px)' : 'translateX(2px)',
            transition: 'transform 150ms var(--default-timing-function)',
          }}
        />
      </SwitchRoot>
      <span>{checked ? 'ON' : 'OFF'}</span>
    </div>
  )
}

const meta = {
  component: SwitchRoot,
  parameters: {
    docs: {
      description: {
        component:
          'A Radix UI Switch wrapper. Use SwitchRoot and SwitchThumb together to create a toggle switch.',
      },
    },
  },
} satisfies Meta<typeof SwitchRoot>

export default meta
type Story = StoryObj<typeof SwitchRoot>

export const Default: Story = {
  render: () => <SwitchExample />,
}
