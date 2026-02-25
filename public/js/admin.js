/* 
  Admin JS Scripts 
*/
console.log("Admin Dashboard scripts loaded.");

// Example functionality: Confirming delete actions
function confirmDelete(userId) {
  if (confirm("Are you sure you want to delete this user?")) {
    // Handle deletion via API
    console.log("Deleting user:", userId);
  }
}
