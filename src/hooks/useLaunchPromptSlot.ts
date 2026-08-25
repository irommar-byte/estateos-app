import { useEffect, useState } from 'react';
import {
  getActiveLaunchPrompt,
  releaseLaunchPrompt,
  requestLaunchPrompt,
  subscribeLaunchPrompt,
  type LaunchPromptId,
} from '../lib/launchPromptQueue';

/** True only while this prompt is first in the launch queue. */
export function useLaunchPromptSlot(id: LaunchPromptId, wantsToShow: boolean): boolean {
  const [active, setActive] = useState(getActiveLaunchPrompt);

  useEffect(() => subscribeLaunchPrompt(() => setActive(getActiveLaunchPrompt())), []);

  useEffect(() => {
    if (wantsToShow) requestLaunchPrompt(id);
    else releaseLaunchPrompt(id);
    return () => releaseLaunchPrompt(id);
  }, [id, wantsToShow]);

  return wantsToShow && active === id;
}
