import type { Meta, StoryObj } from '@storybook/nextjs'
import { SchemaFilePathForm } from './SchemaFilePathForm'

const meta = {
  component: SchemaFilePathForm,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    projectId: {
      description: 'The project ID',
      control: 'text',
    },
    existingPath: {
      description: 'Existing schema file path',
      control: 'text',
    },
    existingFormat: {
      description: 'Existing schema format',
      control: 'select',
      options: ['schemarb', 'postgres', 'prisma', 'tbls', null, undefined],
    },
  },
} satisfies Meta<typeof SchemaFilePathForm>

export default meta
type Story = StoryObj<typeof SchemaFilePathForm>

export const Empty: Story = {
  args: {
    projectId: 'project-123',
    existingPath: null,
    existingFormat: null,
  },
}

export const ExistingFilePath: Story = {
  args: {
    projectId: 'project-123',
    existingPath: 'db/schema.rb',
    existingFormat: 'schemarb',
  },
}
