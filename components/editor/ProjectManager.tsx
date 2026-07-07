'use client';

/**
 * ProjectManager — open and delete saved projects. The persistence layer
 * (lib/persistence/projectStore) already supported this; this is its UI.
 */

import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, Film, Loader2, X } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { listProjects, deleteProject } from '@/lib/persistence/projectStore';
import type { ProjectRecord } from '@/lib/persistence/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

function formatWhen(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ProjectManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const currentProjectId = useEditorStore((s) => s.currentProjectId);

  const refresh = () => {
    setProjects(null);
    listProjects()
      .then((rows) => setProjects(rows))
      .catch(() => setProjects([]));
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleOpen = async (id: string) => {
    setBusyId(id);
    try {
      await useEditorStore.getState().loadProject(id);
      onOpenChange(false);
    } catch {
      useEditorStore.setState({ lastError: 'Could not open that project.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteProject(id);
      if (useEditorStore.getState().currentProjectId === id) {
        useEditorStore.setState({ currentProjectId: null });
      }
      setPendingDelete(null);
      refresh();
    } catch {
      useEditorStore.setState({ lastError: 'Could not delete that project.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Your projects</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Everything is stored locally in your browser — nothing is uploaded.
          </DialogDescription>
        </DialogHeader>

        {projects === null ? (
          <div className="flex items-center justify-center py-10 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Film className="mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">No saved projects yet</p>
            <p className="mt-1 text-xs text-zinc-600">Save from the toolbar, or edits autosave as you go.</p>
          </div>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
            {projects.map((project) => {
              const isCurrent = project.id === currentProjectId;
              const confirming = pendingDelete === project.id;
              return (
                <div
                  key={project.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent ? 'border-signal-400/50 bg-signal-400/[0.06]' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-100">{project.name}</span>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-signal-400/15 px-2 py-0.5 text-[10px] font-medium text-signal-300">
                          Open
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">Updated {formatWhen(project.updatedAt)}</div>
                  </div>

                  {confirming ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={busyId === project.id}
                        onClick={() => handleDelete(project.id)}
                      >
                        {busyId === project.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                      </Button>
                      <button
                        onClick={() => setPendingDelete(null)}
                        title="Cancel"
                        className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 px-2.5 text-xs"
                        disabled={busyId === project.id || isCurrent}
                        onClick={() => handleOpen(project.id)}
                      >
                        {busyId === project.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <FolderOpen className="h-3 w-3" />
                            Open
                          </>
                        )}
                      </Button>
                      <button
                        onClick={() => setPendingDelete(project.id)}
                        title="Delete project"
                        className="rounded p-1 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
