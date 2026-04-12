'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useEditorStore, type TutorialMode } from '@/stores/editorStore';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';

export function TutorialLauncher() {
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<TutorialMode>('quick');

  const {
    tutorialShowWelcome,
    tutorialCompleted,
    tutorialDismissed,
    startTutorial,
    exitTutorial,
    dismissWelcome,
    resumeTutorial,
    resetTutorialProgress,
    setTutorialMode,
  } = useEditorStore();

  function handleHelpClick() {
    // Always show the mode selection dialog when the help button is clicked
    setRestartDialogOpen(true);
  }

  function handleStartTutorial() {
    setTutorialMode(selectedMode);
    dismissWelcome();
    startTutorial();
  }

  function handleSkipWelcome() {
    exitTutorial();
    dismissWelcome();
  }

  function handleStartMode(mode: TutorialMode) {
    setRestartDialogOpen(false);
    setTutorialMode(mode);
    resetTutorialProgress();
    startTutorial();
  }

  function handleResume() {
    setRestartDialogOpen(false);
    resumeTutorial();
  }

  return (
    <>
      {/* Welcome dialog for new users */}
      <Dialog open={tutorialShowWelcome} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Welcome to MusicVid Pro</DialogTitle>
            <DialogDescription>
              Take a tour to learn how to sync your music with video, detect BPM, and export your project.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={selectedMode}
            onValueChange={(v) => setSelectedMode(v as TutorialMode)}
            className="mt-2 gap-3"
          >
            <div className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 cursor-pointer hover:border-zinc-600 transition-colors">
              <RadioGroupItem value="quick" id="mode-quick" className="mt-0.5" />
              <div>
                <Label htmlFor="mode-quick" className="font-medium cursor-pointer">Quick Tour <span className="text-zinc-400 font-normal">(10 steps)</span></Label>
                <p className="text-xs text-zinc-400 mt-0.5">The essentials — get up and running in a few minutes.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 cursor-pointer hover:border-zinc-600 transition-colors">
              <RadioGroupItem value="dev" id="mode-dev" className="mt-0.5" />
              <div>
                <Label htmlFor="mode-dev" className="font-medium cursor-pointer">Dev Tour <span className="text-zinc-400 font-normal">(52 steps)</span></Label>
                <p className="text-xs text-zinc-400 mt-0.5">Every feature, in depth. For power users and developers.</p>
              </div>
            </div>
          </RadioGroup>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={handleSkipWelcome}>
              Skip for now
            </Button>
            <Button onClick={handleStartTutorial}>
              Start
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restart / Resume dialog */}
      <Dialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tutorial</DialogTitle>
            <DialogDescription>
              Pick a tour or resume where you left off.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2">
            <Button className="w-full justify-start" onClick={() => handleStartMode('quick')}>
              Quick Tour <span className="ml-1 text-xs opacity-60">(10 steps)</span>
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => handleStartMode('dev')}>
              Dev Tour <span className="ml-1 text-xs opacity-60">(52 steps)</span>
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={handleResume}>
              Resume
            </Button>
            <Button variant="ghost" className="w-full justify-start text-zinc-400" onClick={() => setRestartDialogOpen(false)}>
              Skip for now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Persistent help button */}
      <Button
        variant="ghost"
        size="icon"
        title="Tutorial"
        onClick={handleHelpClick}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
    </>
  );
}
