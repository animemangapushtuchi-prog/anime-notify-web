// リアルタイム更新（onSnapshot）が必要な画面だけが使う、通常版の Firestore。
//
// サイト全体は軽量版（firebase/firestore/lite）を使っている（lib/firebase.ts の db）。
// 軽量版は同じデータを同じ書き方で読み書きできるが、リアルタイム更新だけが無い。
// 通常版は大きい（全ページの初期JSが gzip で約90KB増える）ので、必要な画面だけここから読み込む。
//
// 注意：ここの liveDb は "firebase/firestore" の関数とだけ組み合わせること。
// lib/firebase.ts の db（軽量版）と通常版の関数を混ぜると実行時エラーになる。
import { getFirestore } from "firebase/firestore";
import { app } from "@/lib/firebase";

export const liveDb = getFirestore(app);
