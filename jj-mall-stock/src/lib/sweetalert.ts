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
    text = options?.itemName
      ? `รายการ "${options.itemName}"\nเมื่อรายการนี้ถูกลบ คุณไม่สามารถกู้คืนได้!!`
      : 'เมื่อรายการนี้ถูกลบ คุณไม่สามารถกู้คืนได้!!',
    confirmButtonText = 'ตกลง',
    cancelButtonText = 'ยกเลิก',
  } = options || {};

  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
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
 */
export const showSuccessAlert = async (title: string, text?: string, timer = 1600) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    timer,
    showConfirmButton: timer ? false : true,
    confirmButtonColor: '#10b981',
    confirmButtonText: 'ตกลง',
    customClass: {
      popup: 'swal2-thai-popup',
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
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ตกลง',
    customClass: {
      popup: 'swal2-thai-popup',
    },
  });
};

export default Swal;
