let widget = new ListWidget();
widget.setPadding(16, 16, 16, 16);

widget.backgroundColor = new Color("212121");

const spc = 5;

let titleTxt = widget.addText(`Petrolimex`);
titleTxt.font = Font.semiboldSystemFont(14);
titleTxt.leftAlignText();

let vlFnt = Font.semiboldSystemFont(13);

let ptFnt = Font.systemFont(9);

titleTxt.textColor = new Color("03fcec");
ptCol = Color.lightGray();

await loadSite();

if (!config.runsInWidget) widget.presentSmall();
Script.setWidget(widget);
Script.complete();

async function loadSite() {
  let url = "https://www.pvoil.com.vn/truyen-thong/tin-gia-xang-dau";
  let wbv = new WebView();
  await wbv.loadURL(url);
  let jsc = `
  var arr = new Array()

var obj1 = document
      .getElementsByClassName('table')[0]
      .getElementsByTagName('td')[6]
      .innerText
  arr.push(obj1)
var p1 = document
      .getElementsByClassName('table')[0]
      .getElementsByTagName('td')[7]
      .innerText
  arr.push(p1)
  
var obj2 = document
      .getElementsByClassName('table')[0]
      .getElementsByTagName('td')[10]
      .innerText
  arr.push(obj2)
var p2 = document
      .getElementsByClassName('table')[0]
      .getElementsByTagName('td')[11]
      .innerText
  arr.push(p2)
  
var obj3 = document
      .getElementsByClassName('table')[0]
      .getElementsByTagName('td')[14]
      .innerText
  arr.push(obj3)
var p3 = document
      .getElementsByClassName('table')[0]
      .getElementsByTagName('td')[15]
      .innerText
  arr.push(p3)

var time = document
      .getElementsByClassName('select-form')[0]
      .getElementsByTagName('option')[0]
      .innerText
  arr.push(time)
  
  JSON.stringify(arr)
  `;

  let jsn = await wbv.evaluateJavaScript(jsc);

  let val = JSON.parse(jsn);

  function addPlus(x) {
    if (parseInt(val[x]) > 0) {
      return `▲${val[x]}`;
    } else if (parseInt(val[x]) == 0) return ``;
    else return `▼${val[x].split("-")[1]}`;
  }

  let obj1 = val[0];
  let p1 = addPlus(1);
  let obj2 = val[2];
  let p2 = addPlus(3);
  let obj3 = val[4];
  let p3 = addPlus(5);
  let time = val[6];

  function setCol(x, y) {
    if (parseFloat(x) < 0) y.textColor = new Color("1db954");
    else y.textColor = new Color("FA1024");
  }

  let tx = widget.addText(`Refresh: ${time}`);
  tx.textColor = Color.white();
  tx.font = Font.systemFont(11);
  tx.leftAlignText();
  widget.addSpacer(spc);

  if (obj1 != null) {
    let tx2 = widget.addText(`${obj1}₫ ${p1}`);
    tx2.leftAlignText();
    tx2.font = vlFnt;
    setCol(p1, tx2);
  }

  let tx1 = widget.addText(`RON95-III`);
  tx1.textColor = ptCol;
  tx1.font = ptFnt;
  tx1.leftAlignText();
  widget.addSpacer(spc);

  if (obj2 != null) {
    let tx4 = widget.addText(`${obj2}₫ ${p2}`);
    tx4.leftAlignText();
    tx4.font = vlFnt;
    setCol(p2, tx4);
  }

  let tx3 = widget.addText(`RON92-II`);
  tx3.textColor = ptCol;
  tx3.font = ptFnt;
  tx3.leftAlignText();
  widget.addSpacer(spc);

  if (obj3 != null) {
    let tx6 = widget.addText(`${obj3}₫ ${p3}`);
    tx6.leftAlignText();
    tx6.font = vlFnt;
    setCol(p3, tx6);
  }

  let tx5 = widget.addText(`DO 0.05S-II`);
  tx5.textColor = ptCol;
  tx5.font = ptFnt;
  tx5.leftAlignText();
}
