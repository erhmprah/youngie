// components/ui/AlertContainer.tsx

import React from 'react';
import CustomAlertModal from './CustomAlertModal';
import { useAlert } from '@/contexts/AlertContext';

const AlertContainer: React.FC = () => {
  const { alert, hideAlert } = useAlert();

  return (
    <CustomAlertModal
      visible={alert.visible}
      type={alert.type}
      title={alert.title}
      message={alert.message}
      buttons={alert.buttons}
      dismissable={alert.dismissable}
      loading={alert.loading}
      onDismiss={hideAlert}
    />
  );
};

export default AlertContainer;
