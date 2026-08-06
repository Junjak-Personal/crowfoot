import { describe, expect, it } from 'vitest'
import { formatArguments } from './formatArguments'

describe('formatArguments', () => {
  describe('formatRemoveOperation - index deletion bug fix', () => {
    it('should display "Removing index" for index deletion, not "Removing table"', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users/indexes/idx_email',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing index 'idx_email'"])
    })

    it('should display "Removing index" for index with complex name', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/document_embeddings/indexes/idx_document_embeddings',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing index 'idx_document_embeddings'"])
    })

    it('should display "Removing constraint" for constraint deletion', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users/constraints/fk_user_role',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing constraint 'fk_user_role'"])
    })

    it('should display "Removing column" for column deletion', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users/columns/email',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing column 'email'"])
    })

    it('should display "Removing table" for table deletion', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["Removing table 'users'"])
    })

    it('should NOT match table when path contains nested resources', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/products/indexes/idx_product_name',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).not.toContain("Removing table 'products'")
      expect(result).toEqual(["  Removing index 'idx_product_name'"])
    })

    it('should display "Removing enum" for enum deletion', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/enums/user_status',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["Removing enum 'user_status'"])
    })

    it('should display "Removing extension" for extension deletion', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/extensions/uuid-ossp',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["Removing extension 'uuid-ossp'"])
    })

    it('should handle unknown path gracefully', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/unknown/path',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(['Removing /unknown/path'])
    })

    it('should handle missing path', () => {
      const args = {
        operations: [
          {
            op: 'remove',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(['Removing unknown'])
    })
  })

  describe('formatReplaceOperation - update operations', () => {
    it('should display "Updating index" for index update', () => {
      const args = {
        operations: [
          {
            op: 'replace',
            path: '/tables/users/indexes/idx_email',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Updating index 'idx_email'"])
    })

    it('should display "Updating constraint" for constraint update', () => {
      const args = {
        operations: [
          {
            op: 'replace',
            path: '/tables/users/constraints/fk_user_role',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Updating constraint 'fk_user_role'"])
    })

    it('should display "Updating column" for column update', () => {
      const args = {
        operations: [
          {
            op: 'replace',
            path: '/tables/users/columns/email',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Updating column 'email'"])
    })

    it('should handle unknown path gracefully', () => {
      const args = {
        operations: [
          {
            op: 'replace',
            path: '/unknown/path',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(['Updating /unknown/path'])
    })

    it('should handle missing path', () => {
      const args = {
        operations: [
          {
            op: 'replace',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(['Updating unknown'])
    })
  })

  describe('multiple operations', () => {
    it('should format multiple remove operations correctly', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users/indexes/idx_email',
          },
          {
            op: 'remove',
            path: '/tables/users/constraints/fk_user_role',
          },
          {
            op: 'remove',
            path: '/tables/users/columns/deprecated_field',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual([
        "  Removing index 'idx_email'",
        "  Removing constraint 'fk_user_role'",
        "  Removing column 'deprecated_field'",
      ])
    })

    it('should format mixed operations correctly', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users/indexes/idx_old',
          },
          {
            op: 'replace',
            path: '/tables/users/indexes/idx_email',
          },
          {
            op: 'remove',
            path: '/tables/old_table',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual([
        "  Removing index 'idx_old'",
        "  Updating index 'idx_email'",
        "Removing table 'old_table'",
      ])
    })
  })

  describe('edge cases', () => {
    it('should handle index name extraction from complex paths', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/very_long_table_name/indexes/idx_very_long_index_name',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing index 'idx_very_long_index_name'"])
    })

    it('should handle paths with special characters in names', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables/users/indexes/idx_user_email_v2',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing index 'idx_user_email_v2'"])
    })

    it('should use fallback name when regex does not match', () => {
      const args = {
        operations: [
          {
            op: 'remove',
            path: '/tables//indexes/',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing index 'index'"])
    })
  })

  describe('operation type variations', () => {
    it('should handle "type" field instead of "op" field', () => {
      const args = {
        operations: [
          {
            type: 'remove',
            path: '/tables/users/indexes/idx_email',
          },
        ],
      }

      const result = formatArguments(args)

      expect(result).toEqual(["  Removing index 'idx_email'"])
    })
  })
})
