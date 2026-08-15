if (localStorage.getItem(`currentUser`)) {
    window.location.href = `lk/index.html`
}

const form = document.getElementById(`login`)

form.addEventListener(`submit`, (e) => {
    e.preventDefault();

    const email = document.getElementById(`email`).value.trim()
    const password = document.getElementById(`password`).value

    if (!email || !password) {
        alert(`заполните все поля`)
        return
    }

    const users = JSON.parse(localStorage.getItem(`users`) || `[]`)
    const user = users.find(u => u.email === email && u.password === password)

    if (!user) {
        alert(`неверный email или пароль`)
        return
    }

    localStorage.setItem(`currentUser`, JSON.stringify({ name: user.name, email: user.email }))
    alert(`вход выполнен`)
    window.location.href = `lk/index.html`
});
