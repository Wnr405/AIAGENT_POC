import { IconButton, Menu, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import { useState, type MouseEvent } from 'react';
import { StatusChip } from '../../../design-system/components';
import { t } from '../../../shared/i18n/t';
import { formatRelative } from '../../../shared/utils/format';
import { displayStatus } from '../types/content.logic';
import type { ContentSummary } from '../types/content.types';

export interface ContentTableProps {
  items: ContentSummary[];
  sort: 'updatedAt' | 'title' | 'status';
  order: 'asc' | 'desc';
  onSort: (field: 'updatedAt' | 'title' | 'status') => void;
  onOpen: (item: ContentSummary) => void;
  onDelete?: (item: ContentSummary) => void;
}

/** Presentational (props only) — 03-DESIGN §12.3 table. */
export function ContentTable({ items, sort, order, onSort, onOpen, onDelete }: ContentTableProps) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: ContentSummary } | null>(null);
  const header = (field: 'updatedAt' | 'title' | 'status', label: string) => (
    <TableSortLabel active={sort === field} direction={sort === field ? order : 'asc'} onClick={() => onSort(field)}>
      {label}
    </TableSortLabel>
  );
  return (
    <>
      <Table size="medium" aria-label={t('content.title')}>
        <TableHead>
          <TableRow>
            <TableCell sortDirection={sort === 'title' ? order : false}>{header('title', t('content.title'))}</TableCell>
            <TableCell sortDirection={sort === 'status' ? order : false}>{header('status', t('content.status'))}</TableCell>
            <TableCell>{t('content.author')}</TableCell>
            <TableCell sortDirection={sort === 'updatedAt' ? order : false}>{header('updatedAt', t('content.updated'))}</TableCell>
            <TableCell align="right">
              <span className="visually-hidden">{t('common.actions')}</span>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const ds = displayStatus(item);
            return (
              <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(item)}>
                <TableCell component="th" scope="row">
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpen(item);
                    }}
                    style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {item.title}
                  </a>
                </TableCell>
                <TableCell>
                  <StatusChip status={ds} label={t(`status.${ds}`)} />
                </TableCell>
                <TableCell>{item.author.name ?? t('common.none')}</TableCell>
                <TableCell title={item.updatedAt}>{formatRelative(item.updatedAt)}</TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  {onDelete && (
                    <IconButton
                      aria-label={`${t('common.actions')}: ${item.title}`}
                      onClick={(e: MouseEvent<HTMLElement>) => setMenu({ anchor: e.currentTarget, item })}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) onOpen(menu.item);
            setMenu(null);
          }}
        >
          {t('common.edit')}
        </MenuItem>
        {onDelete && (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              if (menu) onDelete(menu.item);
              setMenu(null);
            }}
          >
            {t('common.delete')}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
