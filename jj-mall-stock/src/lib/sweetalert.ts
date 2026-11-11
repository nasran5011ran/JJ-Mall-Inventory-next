import Swal from 'sweetalert2';

/**
 * Modern SweetAlert2 Delete Confirmation Alert
 * Matches the requested UI:
 * - Warning icon with orange exclamation
 * - Title: "ลบรายการนี้หรือไม่?"
 * - Text: "เมื่อรายการนี้ถูกลบ คุณไม่สามารถกู้คืนได้!!"
 * - Left button: "ยกเลิก" (Gray)
 * - Right button: "ตกลง" (Orange/Coral)
 */
export const confirmDeleteAlert = async (options?: {
  title?: string;
  text?: string;
  itemName?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}): Promise<boolean> => {
  const {
    title = 'ลบรายการนี้หรือไม่?',
    text = options?.text || 'เมื่อรายการนี้ถูกลบ คุณไม่สามารถกู้คืนได้!!',
    confirmButtonText = 'ตกลง',
    cancelButtonText = 'ยกเลิก',
  } = options || {};

  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    width: 410,
    showCancelButton: true,
    confirmButtonColor: '#f27474',
    cancelButtonColor: '#7a7a7a',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true, // "ยกเลิก" on left, "ตกลง" on right
    focusCancel: true,
    customClass: {
      popup: 'swal2-thai-popup',
      title: 'swal2-thai-title',
      htmlContainer: 'swal2-thai-text',
      confirmButton: 'swal2-thai-confirm',
      cancelButton: 'swal2-thai-cancel',
      actions: 'swal2-thai-actions',
    },
  });

  return result.isConfirmed;
};

/**
 * Success Alert
 * - Matches Reference Image 2:
 * - Width 410px (same as delete modal)
 * - Animated green checkmark
 * - Clean popup without confirm button or progress bar
 * - Displays for 2.2 seconds then auto-dismisses smoothly
 */
export const showSuccessAlert = async (title: string, text?: string, timer = 2200) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    width: 410,
    timer,
    timerProgressBar: false,
    showConfirmButton: false,
    customClass: {
      popup: 'swal2-thai-popup',
      title: 'swal2-thai-title',
      htmlContainer: 'swal2-thai-text',
      actions: 'swal2-thai-actions',
    },
  });
};

/**
 * Error Alert
 */
export const showErrorAlert = async (title: string, text?: string) => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    width: 410,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ตกลง',
    customClass: {
      popup: 'swal2-thai-popup',
      title: 'swal2-thai-title',
      htmlContainer: 'swal2-thai-text',
      confirmButton: 'swal2-thai-confirm',
      actions: 'swal2-thai-actions',
    },
  });
};

export default Swal;
