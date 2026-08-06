import type { Meta, StoryObj } from '@storybook/nextjs'
import { BranchDetailPageView } from './BranchDetailPageView'

const meta = {
  component: BranchDetailPageView,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    projectId: {
      description: 'Project ID',
      control: 'text',
    },
    branchOrCommit: {
      description: 'Branch name or commit SHA',
      control: 'text',
    },
  },
} satisfies Meta<typeof BranchDetailPageView>

export default meta
type Story = StoryObj<typeof BranchDetailPageView>

export const WithSchemaPath: Story = {
  name: 'With schema path',
  args: {
    projectId: 'project-id',
    branchOrCommit: 'main',
    project: {
      name: 'Sample Project',
      schemaPath: {
        path: 'db/schema.rb',
        format: 'schemarb',
      },
    },
  },
}

export const WithoutSchemaPath: Story = {
  name: 'Without schema path',
  args: {
    projectId: 'project-id',
    branchOrCommit: 'main',
    project: {
      name: 'Sample Project',
      schemaPath: null,
    },
  },
}
