const btnEncrypt = document.getElementById('btnEncrypt')
const btnDecrypt = document.getElementById('btnDecrypt');
const btnRecoverPassword = document.getElementById('btnRecoverPassword');
const passField = document.getElementById('password')
const statusElement = document.getElementById('status');
const progressDiv = document.getElementById('progress');

btnEncrypt.addEventListener('click', async () => {
  const pass = passField.value;

  window.files.encodeFile(pass)
})

btnDecrypt.addEventListener('click', async () => {
  const pass = passField.value;

  window.files.decodeFile(pass)
});

btnRecoverPassword.addEventListener('click', async () => {
    window.files.recoverPassword()
});

window.files.handleNotification((event, data) => {
    statusElement.innerText = "Status: " + data.message;
    if (data.progress) {
        data.progress = Math.round(data.progress * 100) / 100;
        progressDiv.style.display = "block";
        progressDiv.style.width = data.progress + "%";
        progressDiv.innerText = data.progress + "%";
    } else if (data.progress === 0) {
        progressDiv.style.display = "none";
    }
})