/* 1. expressモジュールをロードし、インスタンス化してappに代入。*/
const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const uuid = require("uuid");
const crypto = require("crypto");
const mysql = require("mysql");

//mysqlとの接続
const connection = mysql.createConnection({
    host: '127.0.0.1',
    port: '3306',
    user: 'webapp',
    password: 'F13579@s24680',
    database: 'shiftapp'
  });
connection.connect((err) => {
    if (err) {
        console.log('error connecting: ' + err.stack);
        return
    }
    console.log('success');
    });

const app = express();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));//bodyを使うために必要な二文
app.use(cookieParser());

/* 2. listen()メソッドを実行して3000番ポートで待ち受け。*/
const server = app.listen(3000, function(){
    console.log("Node.js is listening to PORT:" + server.address().port);
});

let allshifts = [];

//シフト管理をするメイン画面の処理
app.get("/", function(req, res, next){
    const username = req.cookies.username;//Cookieにはwebサイトにアクセスするときにブラウザがサーバに送信する任意のキーと値のペアが格納される
    const token = req.cookies.token;
    const usersquery = `SELECT * FROM users WHERE username = ? AND token = ?`;
    connection.query(usersquery, [username, token], (err, results) => {
        if(err) {
            console.error("Error executing query: ", err);
            return;
        } else if(results.length === 0) {
            return res.redirect("/login");
        } else {
            const select_shiftquery = `SELECT * FROM shifts WHERE ena = 1 ORDER BY (username != ?), date, username`;
            connection.query(select_shiftquery, [username], (err, result) => {
                if(err) {
                    throw err;
                } else {
                    allshifts = result.map(shift => {
                        return {
                            ...shift,//スプレッド構文、shiftオブジェクトのそれぞれの要素を個別に展開し、すべてのプロパティを新しいオブジェクトにコピーしている
                            date: formatDate(shift.date),//dateなどについては上で代入した上でさらに上書きする
                            start_time: formatTime(shift.start_time),
                            end_time: formatTime(shift.end_time)
                        };
                    });
                    res.render("index", {
                        title: "Shift_Management",
                        shifts: allshifts,
                        username: username
                    });
                }
            });
        }
    });
});
//シフト登録ボタンの処理
app.post("/", function(req, res, next) {
    const username = req.cookies.username;
    const token = req.cookies.token;
    const usersquery = `SELECT * FROM users WHERE username = ? AND token = ?`;
    let user = {};
    connection.query(usersquery, [username, token], (err, results) => {
        if(err) {
            console.error("Error executing query: ", err);
            return;
        } else if(results.length === 0) {
            return res.redirect("/login");
        } else {
            user = results[0];
            const shift = {
                user_id: user.id,
                username: username,
                date: req.body.date,//入力データは req.body.<input>要素のname値 で取得できる
                start_time: req.body.start_time,
                end_time: req.body.end_time,
                comment: req.body.comment,
                ena: 1,
            };
            const insert_shiftquery = `INSERT INTO shifts SET ?`;
            connection.query(insert_shiftquery, shift, (err) => {
                if(err) {
                    throw err;
                } else {
                    res.redirect("/");
                }
            });
        };
    });
});

//削除ボタンが押された際の処理
app.post("/delete_shift", function(req, res, next){
    const id = req.body.id;
    const update_ena_query = `UPDATE shifts SET ena = 0 WHERE id = ?`;
    connection.query(update_ena_query, [id], (err) => {
        if(err) {
            throw err;
        } else {
            res.redirect("/");
        }
    }); 
});
//修正ボタンが押された際の処理
app.post("/revision_shift", function(req, res, next){
    const id = req.body.id;
    const query = `SELECT * FROM shifts WHERE id = ?`;
    connection.query(query, [id], (err, result) => {
        if(err) {
            throw err;
        } else {
            shift = result[0];
            shift.date = formatDate(shift.date);
            res.render("revision", {
                title: "Shift_revision",
                shift: {
                    ...shift,
                }
            });
        }
    });
});
//シフト更新ボタンが押された時の処理
app.post("/update_shift", function(req, res, next) {
    const id = req.body.id;
    const username = req.body.username;
    const date = req.body.date;
    const start_time = req.body.start_time;
    const end_time = req.body.end_time;
    const comment = req.body.comment;
    const update_shiftquery = `UPDATE shifts SET username = ?, date = ?, start_time = ?, end_time = ?, comment = ? WHERE id = ?`;
    const shift = [username, date, start_time, end_time, comment, id];
    connection.query(update_shiftquery, shift, (err) => {
        if(err) {
            throw err;
        } else {
            res.redirect("/");
        }
    });
});



//ログアウトボタンを押された時の処理
app.post("/logout", function(req, res, next){
    const username = req.cookies.username;
    const updatequery = `UPDATE users SET token = NULL WHERE username = ?`;
    connection.query(updatequery, [username], (err) => {
        if(err) {
            console.error("Error executing query: ", err);
            return;
        }
    });
    res.clearCookie("username");//usernameおよびtokenのクッキーを削除する
    res.clearCookie("token");
    res.redirect("/login");
})

//ログイン画面アクセス時の処理
app.get("/login", function(req, res, next){
    res.render("login", {
        error: false,
        title: "Login",
    });
});
//ログインボタンを押された時の処理
app.post("/login", function(req, res, next){
    const enteredusername = req.body.username;
    const enteredpassword = req.body.password;
    const hashedEnteredpassword = crypto.createHash("md5").update(enteredpassword).digest("hex");//パスワードをハッシュ化
    let user = {};
    /*crypto.createHashメソッドを使ってmd5ハッシュアルゴリズム(任意長のデータを受け取り16バイト(16進数32文字)のハッシュ値を生成する)を使ったハッシュオブジェクトを生成する。
    updateメソッドを使って、生成したハッシュオブジェクトにパスワード文字列を渡す
    digestメソッドを使って生成したハッシュ値を16進数(hex)の文字列形式で取得する
    */
    const usersquery = `SELECT * FROM users WHERE username = ? AND password = ?`;//?にはこの後指定した変数が入る
    connection.query(usersquery, [enteredusername, hashedEnteredpassword], (err, results) => {//errは正常実行の場合null,resultsにはJSON形式でデータが入る、また、該当するデータがない場合は空の配列が入る
        if(err) {
            console.error("Error executing query: ", err);
        }

        if(results.length === 0) {
            return res.render("login", {
                error: true,
                title: "Login",
            });
        }
        user = results[0];
        const token = generateToken();
        updateUserToken(user, token);
        res.cookie("username", enteredusername);
        res.cookie("token", token);
        res.redirect("/");
    });
});

//ユーザ登録画面アクセスの処理
app.get("/register", function(req, res, next){
    res.render("register", {
        error: false,
        title: "Register"
    });
});
//ユーザ登録ボタンの処理
app.post("/register", function(req, res, next){
    const newusername = req.body.username;
    const newpassword = req.body.password;
    const hashednewpassword = crypto.createHash("md5").update(newpassword).digest("hex");

    const usersquery = `SELECT * FROM users WHERE username = ?`;
    connection.query(usersquery, [newusername], (err, results) => {
        if(err) {
            console.error("Error executing query: ", err);
            return;
        }
        if(results.length !== 0) {
            return res.render("register", {
                error: true,
                title: "Register",
            });
        }
    });
    const insertquery = `INSERT INTO users (username, password) VALUES (?, ?)`;
    connection.query(insertquery, [newusername, hashednewpassword], (err) => {
        if(err) {
            console.error("Error executing query: ", err);
            return;
        }
    });

    res.redirect("/login");
});

//以下関数
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

  
function formatTime(timeString) {
    const [hour, minute] = timeString.split(':');
    return `${hour}:${minute}`;
}
  
function generateToken() {//トークンを生成する関数
    return uuid.v4();
}
function updateUserToken(user, token) {//ユーザートークンを更新しmysqlに保存する関数
    const query = `UPDATE users SET token = ? WHERE id = ?`;
    connection.query(query, [token, user.id], (err) => {
        if(err) {
            console.error("Error executing query: ", err);
            return;
        }
    });
}