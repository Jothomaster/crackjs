const btnEncrypt = document.getElementById('btnEncrypt')
const btnDecrypt = document.getElementById('btnDecrypt');
const passField = document.getElementById('password')
const filePathElement = document.getElementById('filePath')

btnEncrypt.addEventListener('click', async () => {
  const pass = passField.value;
  if(!pass) {
    // alert("No password provided");
    return;
  }

  window.files.encodeFile(pass)
})

btnDecrypt.addEventListener('click', async () => {
  const pass = passField.value;
  if (!pass) {
    // alert("No password provided");
    return;
  }

  window.files.decodeFile(pass)
});