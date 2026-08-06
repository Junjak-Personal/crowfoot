import type { Meta, StoryObj } from '@storybook/nextjs'
import {
  ModalActions,
  ModalClose,
  ModalConfirm,
  ModalContent,
  ModalDescription,
  ModalOverlay,
  ModalPortal,
  ModalRoot,
  ModalTitle,
  ModalTrigger,
} from './Modal'

const ModalExample = () => {
  return (
    <ModalRoot>
      <ModalTrigger>Open Modal</ModalTrigger>
      <ModalPortal>
        <ModalOverlay />
        <ModalContent>
          <ModalTitle>Modal Title</ModalTitle>
          <ModalDescription>
            This is a modal dialog built with Radix UI. You can add any content
            here.
          </ModalDescription>
          <ModalActions>
            <ModalClose>Cancel</ModalClose>
            <ModalConfirm>Confirm</ModalConfirm>
          </ModalActions>
        </ModalContent>
      </ModalPortal>
    </ModalRoot>
  )
}

const meta = {
  component: ModalRoot,
  parameters: {
    docs: {
      description: {
        component:
          'A Radix UI Dialog wrapper. Use ModalRoot, ModalTrigger, ModalPortal, ModalOverlay, ModalContent, ModalTitle, ModalDescription, ModalActions, ModalClose, and ModalConfirm together.',
      },
    },
  },
} satisfies Meta<typeof ModalRoot>

export default meta
type Story = StoryObj<typeof ModalRoot>

export const Default: Story = {
  render: () => <ModalExample />,
}
