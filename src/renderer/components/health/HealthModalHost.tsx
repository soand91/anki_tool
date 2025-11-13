import React from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '../../state/ui';
import HealthModal from './HealthModal';

export default function HealthModalHost() {
  const isOpen = useUiStore(s => s.isHealthModalOpen);
  const defaultLive = useUiStore(s => s.healthModalDefaultLive);
  const close = useUiStore(s => s.closeHealthModal);
  const setLivePref = useUiStore(s => s.setHealthLivePref);

  if (!isOpen) return null;
  return createPortal(
    <HealthModal
      isOpen={isOpen}
      onClose={close}
      defaultLive={defaultLive}
      onLivePrefChange={setLivePref}
    />,
    document.body
  )
}