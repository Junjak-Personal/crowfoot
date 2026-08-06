import type { Meta, StoryObj } from '@storybook/nextjs'
import { FormatIcon } from './FormatIcon'

const meta = {
  component: FormatIcon,
  argTypes: {
    format: {
      control: 'select',
      options: ['postgres', 'prisma', 'schemarb', 'tbls'],
      description: 'The database schema format type',
    },
    size: {
      control: 'number',
      description: 'The size of the icon in pixels',
    },
  },
} satisfies Meta<typeof FormatIcon>

export default meta
type Story = StoryObj<typeof FormatIcon>

export const Postgres: Story = {
  args: {
    format: 'postgres',
    size: 16,
  },
}

export const Prisma: Story = {
  args: {
    format: 'prisma',
    size: 16,
  },
}

export const SchemaRb: Story = {
  args: {
    format: 'schemarb',
    size: 16,
  },
}

export const Tbls: Story = {
  args: {
    format: 'tbls',
    size: 16,
  },
}

export const Large: Story = {
  args: {
    format: 'postgres',
    size: 32,
  },
}

export const ExtraLarge: Story = {
  args: {
    format: 'prisma',
    size: 48,
  },
}
