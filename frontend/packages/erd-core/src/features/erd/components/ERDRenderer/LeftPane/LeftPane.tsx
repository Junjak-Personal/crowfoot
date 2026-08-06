// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  BookText,
  Eye,
  EyeOff,
  GithubLogo,
  Megaphone,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@crowfoot/ui'
import { useNodes } from '@xyflow/react'
import clsx from 'clsx'
import { Fragment, useCallback, useMemo, useSyncExternalStore } from 'react'
import { useVersionOrThrow } from '../../../../../providers'
import { useUserEditingOrThrow } from '../../../../../stores'
import { useCustomReactflow } from '../../../../reactflow/hooks'
import {
  deserializeGroups,
  getBaseGroups,
  getEffectiveGroups,
  isTableNode,
  partitionTablesByGroup,
  subscribeBaseGroups,
} from '../../../utils'
import { updateNodesHiddenState } from '../../ERDContent/utils'
import { useTableVisibility } from '../hooks'
import { CopyLinkButton } from './CopyLinkButton'
import styles from './LeftPane.module.css'
import { MenuItemLink, type Props as MenuItemLinkProps } from './MenuItemLink'
import { TableNameMenuButton } from './TableNameMenuButton'

export const LeftPane = () => {
  const { version } = useVersionOrThrow()
  const { selectedNodeIds, setHiddenNodeIds, groupEntries, showGroups } =
    useUserEditingOrThrow()

  const { setNodes } = useCustomReactflow()

  const menuItemLinks = useMemo(
    (): MenuItemLinkProps[] => [
      {
        label: 'Release Notes',
        href: 'https://github.com/Junjak-Personal/crowfoot/releases',
        noreferrer: true,
        target: '_blank',
        icon: <Megaphone className={styles.icon} />,
      },
      // Upstream's docs, not ours — the parser and schema formats are unchanged
      // in this fork, so they are still correct. Labelled so it does not read as
      // this product's own documentation.
      {
        label: 'Parser Docs (upstream)',
        href: 'https://liambx.com/docs',
        noreferrer: version.displayedOn === 'cli',
        target: '_blank',
        icon: <BookText className={styles.icon} />,
      },
      {
        label: 'Go to GitHub',
        href: 'https://github.com/Junjak-Personal/crowfoot',
        noreferrer: true,
        target: '_blank',
        icon: <GithubLogo className={styles.icon} />,
      },
    ],
    [version.displayedOn],
  )

  const nodes = useNodes()
  const tableNodes = useMemo(() => nodes.filter(isTableNode), [nodes])

  // groups.json is fetched by the host app and lands after the first render.
  // The canvas is rebuilt by the `schemaKey` remount when it does; this pane is
  // not, so it subscribes instead of reading the module value once.
  const baseGroups = useSyncExternalStore(
    subscribeBaseGroups,
    getBaseGroups,
    getBaseGroups,
  )

  const groups = useMemo(
    () => getEffectiveGroups(deserializeGroups(groupEntries), baseGroups),
    [groupEntries, baseGroups],
  )

  const partition = useMemo(
    () => partitionTablesByGroup(tableNodes, groups),
    [tableNodes, groups],
  )

  // `partition.flat` — never the group-view sections, which repeat a table in
  // every group it belongs to — is the source of both counts in BOTH modes,
  // so a table in two groups is never double-counted as "48/60 visible".
  const allCount = partition.flat.length
  const visibleCount = partition.flat.filter((node) => !node.hidden).length

  const { visibilityStatus, showAllNodes, hideAllNodes } = useTableVisibility()

  const showSelectedTables = useCallback(() => {
    if (selectedNodeIds.size > 0) {
      // Scoped to table nodes only (F4): `nodes` also carries memo and group
      // ids, which are never in `selectedNodeIds`, so an unfiltered pass
      // would push them all into `?hidden=` too.
      const hiddenNodeIds = nodes
        .filter(isTableNode)
        .filter((node) => !selectedNodeIds.has(node.id))
        .map((node) => node.id)
      const updatedNodes = updateNodesHiddenState({
        nodes,
        hiddenNodeIds,
        shouldHideGroupNodeId: true,
      })
      setNodes(updatedNodes)
      setHiddenNodeIds(hiddenNodeIds)
    }
  }, [nodes, selectedNodeIds, setNodes, setHiddenNodeIds])

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={styles.groupLabel} asChild>
            <span>Tables</span>
            <span className={styles.tablesHeaderRow}>
              {visibilityStatus === 'all-visible' ? (
                <button
                  type="button"
                  className={styles.showAllButton}
                  aria-label="Hide All Tables"
                  tabIndex={0}
                  onClick={hideAllNodes}
                >
                  <EyeOff className={styles.icon} />
                  <span className={styles.showAllText}>Hide All</span>
                  <span className={styles.visibleCount}>
                    ({visibleCount}/{allCount} visible)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.showAllButton}
                  aria-label="Show All Tables"
                  tabIndex={0}
                  onClick={showAllNodes}
                >
                  <Eye className={styles.icon} />
                  <span className={styles.showAllText}>Show All</span>
                  <span className={styles.visibleCount}>
                    ({visibleCount}/{allCount} visible)
                  </span>
                </button>
              )}
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {showGroups && partition.sectioned ? (
              // Group view: sectioned by group, "Ungrouped" last, a table in
              // N groups rendered N times — the shift-range `nodes` prop is
              // `flattenedUnique` (dedup'd, first-appearance order) so it
              // matches the visual order (F9 / handleShiftSelection).
              <SidebarMenu className={styles.tablesMenu}>
                {partition.sections.map((section) => (
                  // The group arm is prefixed so a group whose id is literally
                  // `ungrouped` cannot collide with the synthetic trailing
                  // section. Group ids come from groups.json, so that is a
                  // reachable value, not a hypothetical one.
                  <Fragment
                    key={
                      section.group === null
                        ? 'ungrouped'
                        : `group:${section.group.id}`
                    }
                  >
                    <SidebarMenuItem
                      className={clsx(
                        styles.sectionLabel,
                        section.group === null && styles.sectionLabelUngrouped,
                      )}
                    >
                      {section.group !== null && (
                        <span
                          aria-hidden="true"
                          className={styles.sectionDot}
                          data-view-color={section.group.color}
                        />
                      )}
                      <span className={styles.sectionName}>
                        {section.group ? section.group.name : 'Ungrouped'}
                      </span>
                    </SidebarMenuItem>
                    {section.nodes.map((node) => (
                      <TableNameMenuButton
                        key={node.id}
                        node={node}
                        nodes={partition.flattenedUnique}
                        showSelectedTables={showSelectedTables}
                      />
                    ))}
                  </Fragment>
                ))}
              </SidebarMenu>
            ) : (
              // Single view (default toggle-off, and the empty-state fallback
              // for group view too — UI/UX ruling 10): today's flat
              // alphabetical list, every table exactly once. This branch is
              // deliberately kept byte-identical to that list rather than
              // folded into the sectioned branch above, which is what
              // guarantees the escape hatch never drifts from it.
              <SidebarMenu className={styles.tablesMenu}>
                {partition.flat.map((node) => (
                  <TableNameMenuButton
                    key={node.id}
                    node={node}
                    nodes={partition.flat}
                    showSelectedTables={showSelectedTables}
                  />
                ))}
              </SidebarMenu>
            )}

            <SidebarMenu className={styles.contentControls}>
              <CopyLinkButton />
            </SidebarMenu>

            <SidebarMenu className={styles.contentLinks}>
              {menuItemLinks.map((item) => (
                <MenuItemLink {...item} key={item.label} />
              ))}
              <SidebarMenuItem className={styles.versionWrapper}>
                <div className={styles.version}>
                  <span className={styles.versionText}>{`${
                    version.version
                  } + ${version.gitHash.slice(0, 7)} (${version.date})`}</span>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
