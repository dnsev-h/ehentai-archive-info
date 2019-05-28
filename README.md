# E*Hentai Archive Info

Add info.json files to archives.

Prerequisites:
* [7zip](https://www.7-zip.org/)
* [nodejs](https://nodejs.org/) (node and nmp required)

First time setup:
* Run ```setup.bat```

Updating archives:
* Drag and drop archive files onto ```batch.bat```

---

## Using exhentai

By default, e-hentai will be used rather than exhentai.
If you want to use exhentai, you must set up the required authentication cookies.
You can do this by creating a file called ```cookies.txt``` in the project root folder,
and pasting a cookie string into the contents. Make sure to remove any quotes.

To find your cookie string, open a web browser which is logged in, open the website,
and then open the browser's developer tools (shortcut key: F12). Then, navigate to the
Console tab and paste the following code:
```js
console.log(document.cookie)
```

This should print your cookie string to the console. For example, the cookie string may look something like this:
```
ipb_member_id=XXXXXXX; ipb_pass_hash=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX; igneous=XXXXXXXXX
```

---

Some source code has been borrowed from [https://dnsev-h.github.io/x/](https://dnsev-h.github.io/x/) with slight modifications.
