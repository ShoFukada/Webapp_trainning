/* 1. expressモジュールをロードし、インスタンス化してappに代入。*/
const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const uuid = require("uuid");
const crypto = require("crypto");

const app = express();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));//bodyを使うために必要な二文
app.use(cookieParser());

/* 2. listen()メソッドを実行して3000番ポートで待ち受け。*/
const server = app.listen(3000, function(){
    console.log("Node.js is listening to PORT:" + server.address().port);
});

const users = JSON.parse(fs.readFileSync("users.txt", "utf8"));//JSON形式のファイルをそのままオブジェクト配列(JSON)として読み込める
const userTokens = JSON.parse(fs.readFileSync("user_tokens.txt", "utf8"));

let allshifts = [];
let usernames = [];

//シフト管理をするメイン画面の処理
app.get("/", function(req, res, next){
    const username = req.cookies.username;//Cookieにはwebサイトにアクセスするときにブラウザがサーバに送信する任意のキーと値のペアが格納される
    const token = req.cookies.token;
    const validToken = userTokens[username];

    if(token!==validToken || !validToken) {//無効なトークンの場合もしくはundefinedの場合に弾く
        return res.redirect("/login");
    }
    
    res.render("index", {
        title: "Shift_Management",
        shifts: allshifts,
        usernames: usernames
    });
});
app.post("/", function(req, res, next) {
    const username = req.cookies.username;
    const token = req.cookies.token;
    const validToken = userTokens[username];

    if(token!==validToken || !validToken) {//トークンが有効かどうか(ファイルにあるトークンと一致するか)を検証
        return res.redirect("/login");
    }

    const shift = {
        date: req.body.date,//入力データは req.body.<input>要素のname値 で取得できる
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        comment: req.body.comment
    };
    allshifts.push(shift);//構造体の配列に代入
    usernames.push(req.body.username);
    res.redirect("/");
});

//ログアウト処理
app.post("/logout", function(req, res, next){
    const username = req.cookies.username;
    delete userTokens[username];
    fs.writeFileSync("user_tokens.txt", JSON.stringify(userTokens));
    res.clearCookie("username");//usernameおよびtokenのクッキーを削除する
    res.clearCookie("token");
    res.redirect("/login");
})

//ログイン画面の処理
app.get("/login", function(req, res, next){
    res.render("login", {
        error: false,
        title: "Login",
    });
});
app.post("/login", function(req, res, next){
    const enteredusername = req.body.username;
    const enteredpassword = req.body.password;
    const hashedEnteredpassword = crypto.createHash("md5").update(enteredpassword).digest("hex");//パスワードをハッシュ化

    /*crypto.createHashメソッドを使ってmd5ハッシュアルゴリズム(任意長のデータを受け取り16バイト(16進数32文字)のハッシュ値を生成する)を使ったハッシュオブジェクトを生成する。
    updateメソッドを使って、生成したハッシュオブジェクトにパスワード文字列を渡す
    digestメソッドを使って生成したハッシュ値を16進数(hex)の文字列形式で取得する
    */
    let founduser = null;
    for(let key in users) {
        if(key === enteredusername && users[key] === hashedEnteredpassword) {
            founduser = {key: users[key]};
            break;
        }
    }
    if(!founduser) {
        return res.render("login", {
            error: true,
            title: "Login",
        });
    }
    const token = generateToken();
    updateUserToken(enteredusername, token);

    res.cookie("username", enteredusername);
    res.cookie("token", token);
    res.redirect("/");
});


function generateToken() {//トークンを生成する関数
    return uuid.v4();
}
function updateUserToken(username, token) {
    userTokens[`${username}`] = token;
    fs.writeFileSync("user_tokens.txt", JSON.stringify(userTokens));//現在のトークンの状態をファイルに書き込む
}