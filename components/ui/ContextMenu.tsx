'use client';

/**
 * Reusable right-click context menu.
 *
 * Usage:
 *   const menu = useContextMenu();
 *   <div onContextMenu={(e) => menu.open(e, buildItems())}>…</div>
 *   {menu.node}   // render once, anywhere (it portals to <body>)
 *
 * Items support separators, section labels, submenus, disabled/danger states,
 * keyboard shortcuts, and fully custom rows (e.g. a velocity slider). The menu
 * portals to the body, flips at viewport edges, and dismisses on outside click,
 * Escape, scroll, resize, or item selection.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export type MenuItem =
  | {
      type?: 'item';
      label: string;
      icon?: LucideIcon;
      onSelect: () => void;
      disabled?: boolean;
      danger?: boolean;
      shortcut?: string;
      /** Keep the menu open after selecting (e.g. a toggle you may toggle again). */
      keepOpen?: boolean;
    }
  | { type: 'separator' }
  | { type: 'label'; label: string }
  | { type: 'submenu'; label: string; icon?: LucideIcon; items: MenuItem[]; disabled?: boolean }
  | { type: 'custom'; render: (close: () => void) => React.ReactNode };

interface OpenState { x: number; y: number; items: MenuItem[] }

const MENU_MIN_WIDTH = 184;

export function useContextMenu() {
  const [state, setState] = useState<OpenState | null>(null);
  const open = useCallback((e: React.MouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => {
    if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault();
    if (items.length === 0) return;
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);
  const close = useCallback(() => setState(null), []);
  const node = state ? <ContextMenuView x={state.x} y={state.y} items={state.items} onClose={close} /> : null;
  return { open, close, node, isOpen: state !== null };
}

/** Controlled variant — for menus whose open state lives elsewhere (e.g. the
 *  store's timeline trackContextMenu). Renders nothing when `open` is false. */
export function ContextMenu({ open, x, y, items, onClose }: { open: boolean; x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  if (!open || items.length === 0) return null;
  return <ContextMenuView x={x} y={y} items={items} onClose={onClose} />;
}

function ContextMenuView({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Flip/clamp within the viewport once measured.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (x + r.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - r.width - 8);
    if (y + r.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - r.height - 8);
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    // capture scroll anywhere (not the menu itself)
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100]" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        ref={ref}
        role="menu"
        className="absolute rounded-lg border border-zinc-700 bg-zinc-900/98 py-1 shadow-2xl shadow-black/60 backdrop-blur-sm"
        style={{ left: pos.left, top: pos.top, minWidth: MENU_MIN_WIDTH }}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        {items.map((item, i) => <MenuRow key={i} item={item} onClose={onClose} />)}
      </div>
    </div>,
    document.body
  );
}

function MenuRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [subOpen, setSubOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  if ('type' in item && item.type === 'separator') {
    return <div className="my-1 h-px bg-zinc-800" />;
  }
  if ('type' in item && item.type === 'label') {
    return <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{item.label}</div>;
  }
  if ('type' in item && item.type === 'custom') {
    return <div className="px-2 py-1">{item.render(onClose)}</div>;
  }
  if ('type' in item && item.type === 'submenu') {
    const Icon = item.icon;
    return (
      <div ref={rowRef} className="relative"
        onPointerEnter={() => !item.disabled && setSubOpen(true)}
        onPointerLeave={() => setSubOpen(false)}>
        <div className={`flex cursor-default items-center gap-2.5 px-3 py-1.5 text-sm ${item.disabled ? 'text-zinc-600' : 'text-zinc-100 hover:bg-zinc-800'}`}>
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
          <span className="flex-1">{item.label}</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        </div>
        {subOpen && !item.disabled && (
          <div className="absolute left-full top-0 -ml-1 min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-900/98 py-1 shadow-2xl shadow-black/60 backdrop-blur-sm"
            style={{ maxWidth: 240 }}>
            {item.items.map((sub, j) => <MenuRow key={j} item={sub} onClose={onClose} />)}
          </div>
        )}
      </div>
    );
  }

  // default: action item
  const Icon = item.icon;
  return (
    <button
      role="menuitem"
      disabled={item.disabled}
      onClick={() => {
        if (item.disabled) return;
        item.onSelect();
        if (!item.keepOpen) onClose();
      }}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors ${
        item.disabled
          ? 'cursor-not-allowed text-zinc-600'
          : item.danger
            ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
            : 'text-zinc-100 hover:bg-zinc-800'
      }`}
    >
      {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${item.danger ? 'text-red-400' : 'text-zinc-400'}`} />}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && <span className="ml-4 font-mono text-[10px] text-zinc-500">{item.shortcut}</span>}
    </button>
  );
}
