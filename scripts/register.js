if (localStorage.getItem(`currentUser`)) {
    window.location.href = `lk/index.html`
}

const form = document.getElementById(`reg`)

form.addEventListener(`submit`, (e) => {
    e.preventDefault();

    const nigerocheck = document.getElementById(`name`).value.trim()
    const nigerocheck1 = document.getElementById(`email`).value.trim()
    const nigerocheck2 = document.getElementById(`password`).value
    const nigerocheck3 = document.getElementById(`password2`).value

    if (nigerocheck2 !== nigerocheck3) {
        alert(`пароли не совпадают`)
        return
    }

    if (!nigerocheck || !nigerocheck1 || !nigerocheck2 || !nigerocheck3) {
        alert(`заполните все поля`)
        return
    }

    if (nigerocheck2.length < 8) {
        alert(`пароль минимум 8 символов`)
        return
    }

    const users = JSON.parse(localStorage.getItem(`users`) || `[]`)
    const exists = users.find(u => u.email === nigerocheck1)

    if (exists) {
        alert(`такой email уже зарегистрирован`)
        return
    }

    const user = {
      name:  nigerocheck,
      email: nigerocheck1
  }

    users.push({
        name: nigerocheck,
        email: nigerocheck1,
        password: nigerocheck2
    })
    localStorage.setItem(`users`, JSON.stringify(users))
    localStorage.setItem(`currentUser`, JSON.stringify({ name: nigerocheck, email: nigerocheck1 }))
 localStorage.setItem(`currentUser`,JSON.stringify(user))
 
    alert(`аккаунт создан`)
    window.location.href = `lk/index.html`
});
