import { useContext } from 'react';
import { ApertureContext } from '../components/ApertureProvider';

export function useAperture() {
  const context = useContext(ApertureContext);
  if (!context) {
    throw new Error('useAperture must be used within <ApertureProvider>');
  }
  return context;
}
