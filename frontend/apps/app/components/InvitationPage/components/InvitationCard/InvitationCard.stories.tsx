import type { Meta, StoryObj } from '@storybook/nextjs'
import { InvitationCard } from './InvitationCard'

const meta = {
  component: InvitationCard,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof InvitationCard>

export default meta
type Story = StoryObj<typeof InvitationCard>

export const Valid: Story = {
  args: {
    organizationName: 'Acme Corporation',
    token: 'sample-invitation-token-123',
    currentUser: {
      id: 'user-123',
      email: 'john.doe@example.com',
    },
  },
}

export const Invalid: Story = {
  args: {
    organizationName: null,
    token: 'expired-token-456',
    currentUser: {
      id: 'user-123',
      email: 'john.doe@example.com',
    },
  },
}
