'use strict';

let compileMode = 'browser';
try {
  if (require) compileMode = 'nodejs';
} catch(err) { }

const Bluebird = (compileMode === 'nodejs') ? require('bluebird') : null;

const TextCompairUtils = {

  isSmaller(a, b) {
    if (typeof a === "string") return false;
    else if (typeof b === "string") return true;
    else return a < b;
  },

  sentencesSplit(textStr) {

    let tempStrSplit = "".concat(textStr);
    let resultSentencesList = [];
    let finish = false;

    while (!finish) {
      if (tempStrSplit[0] === " ")
        tempStrSplit = tempStrSplit.substr(1);

      let nextDotPos = tempStrSplit.indexOf('.');
      let nextQuestMarkPos = tempStrSplit.indexOf('?');
      let nextExclamMarkPos = tempStrSplit.indexOf('!');

      if (nextDotPos >= 0
      ||  nextQuestMarkPos >= 0
      ||  nextExclamMarkPos >= 0
      ) {
        if (nextDotPos === -1)        nextDotPos = "last";
        if (nextQuestMarkPos === -1)  nextQuestMarkPos = "last";
        if (nextExclamMarkPos === -1) nextExclamMarkPos = "last";

        let newValue = "";
        let endChar = ".";

        if (nextDotPos >= 0
        &&  TextCompairUtils.isSmaller(nextDotPos, nextQuestMarkPos)
        &&  TextCompairUtils.isSmaller(nextDotPos, nextExclamMarkPos)
        ) { // Next is Dot
          newValue = tempStrSplit.substr(0, nextDotPos);
          tempStrSplit = tempStrSplit.substr(nextDotPos +1);
          endChar = ".";
        } else if (nextQuestMarkPos >= 0
        &&  TextCompairUtils.isSmaller(nextQuestMarkPos, nextDotPos)
        &&  TextCompairUtils.isSmaller(nextQuestMarkPos, nextExclamMarkPos)
        ) { // Next is Question Mark
          newValue = tempStrSplit.substr(0, nextQuestMarkPos);
          tempStrSplit = tempStrSplit.substr(nextQuestMarkPos +1);
          endChar = "?";
        } else if (nextExclamMarkPos >= 0
        &&  TextCompairUtils.isSmaller(nextExclamMarkPos, nextDotPos)
        &&  TextCompairUtils.isSmaller(nextExclamMarkPos, nextQuestMarkPos)
        ) { // Next is Exclamtion Mark
          newValue = tempStrSplit.substr(0, nextExclamMarkPos);
          tempStrSplit = tempStrSplit.substr(nextExclamMarkPos +1);
          endChar = "!";
        } else debugger;

        resultSentencesList.push({
          value: newValue,
          endChar
        })

      } else {
        finish = true;
      }
    }

    return resultSentencesList;
  }
}

class TextCompair {
  constructor() {
    this._compairMemory = {
      loopFinish: false,

      textMemory: {
        "last": {
          textIndex: 0, // loopLastTextIndex
          textProcessedCount: -1, // loopLastTextProcessedCount first is not spaced
          textSentencesList: 0
        },
        "current": {
          textIndex: 0,
          textProcessedCount: -1, // loopCurTextProcessedCount first is not spaced
          textSentencesList: 0
        }
      },

      processingCompair: {
        results: null, // Set to [] by start
        resultPendingList: []
      }
    };
  }


  _findTextInPendingList(searchedSentenceObj, sideKey) {
    return this._compairMemory.processingCompair.resultPendingList.findIndex(
      (curPendingSent) => {
        if (!curPendingSent.sentence[sideKey]) return false;

        return curPendingSent.sentence[sideKey].value.toLowerCase() === searchedSentenceObj.value.toLowerCase()}
    );
  }

  _updateTextPendingList(sentenceObj, sideKey, otherSenteceObj) {
    let otherSideKey = (sideKey === "current") ? "last" : "current";
    let targetPendingIndex = this._findTextInPendingList(sentenceObj, otherSideKey);

    let targetTextSideMemory = this._compairMemory.textMemory[sideKey];
    let targetSentPosEnd = targetTextSideMemory.textProcessedCount + sentenceObj.value.length +1;
    let otherTextSideMemory = this._compairMemory.textMemory[otherSideKey];
    let otherSentPosEnd = otherTextSideMemory.textProcessedCount + otherSenteceObj.value.length + 1

    if (targetPendingIndex === -1) { // Kein Pending für Text gefunden
      this._compairMemory.processingCompair.resultPendingList.push({
        sentence: {
          last: (sideKey === "last") ? sentenceObj : null,
          current: (sideKey === "current") ? sentenceObj : null
        },
        _preResult: {
          type: "moved",

          posLastStart: (sideKey === "last") ? targetTextSideMemory.textProcessedCount : null,
          posLastEnd: (sideKey === "last") ? targetSentPosEnd : null,

          posCurStart: (sideKey === "current") ? targetTextSideMemory.textProcessedCount : null,
          posCurEnd: (sideKey === "current") ? targetSentPosEnd : null,

          posCurLastStart: (otherSideKey === "current") ? otherTextSideMemory.textProcessedCount : null,
          posCurLastEnd: (otherSideKey === "current") ? otherSentPosEnd : null,

          lastValue: (sideKey === "last") ? otherSenteceObj : null,
          //curLastValue: (sideKey === "last") ? sentenceObj : null,
          curValue: (sideKey === "current") ? sentenceObj : null
        },
        _sentencesIndex: targetTextSideMemory.textIndex
      });
    } else {
      let pendingResultItem = this._compairMemory.processingCompair.resultPendingList[targetPendingIndex];
      let fillValuesObj = (sideKey === "last")
        ? { posLastStart: targetTextSideMemory.textProcessedCount, posLastEnd: targetSentPosEnd, lastValue: sentenceObj/*,
            posCurLastStart: otherTextSideMemory.textProcessedCount, posCurLastEnd: otherSentPosEnd, curLastValue: otherSenteceObj*/ }
        : { posCurStart: targetTextSideMemory.textProcessedCount, posCurEnd: targetSentPosEnd, curValue: sentenceObj };

      let filledResult = Object.assign({}, pendingResultItem._preResult, fillValuesObj);

      this._compairMemory.processingCompair.results.push(filledResult);
      this._compairMemory.processingCompair.resultPendingList.splice(targetPendingIndex, 1);
      //{ type: "moved", posLastStart, posLastEnd, posCurStart, posCurEnd, lastValue, curValue }
    }

    this._compairMemory.textMemory[sideKey].textProcessedCount = targetSentPosEnd +1; // Add length to lengthCounter +1 = Dot
  }

  _createCompairResult(type, lastSentence, curSentence) {
    let result = {
      type: type,
    };

    if ((type === "current" && curSentence) || (type === "last" && lastSentence))
      return false;

    let states = {
      posLastStart: this._compairMemory.textMemory.last.textProcessedCount,
      posCurStart: this._compairMemory.textMemory.current.textProcessedCount,
    }

    return Object.assign(result, 
      (type === "extended" && curSentence) ? {
        posLastStart: states.posLastStart,
        posCurStart: states.posCurStart,
        posCurEnd: states.posCurStart + curSentence.value.length +1, // +1 = DOT

        curValue: curSentence
      } : (type === "removed" && lastSentence) ? {
        posLastStart: states.posLastStart,
        posLastEnd: states.posLastStart + lastSentence.value.length +1, // +1 = DOT
        posCurStart: states.posCurStart,

        lastValue: lastSentence
      } : (type === "moved") ? {
        /*posLastStart,
          posLastEnd,
          posCurStart,
          posCurEnd,
          lastValue: curLoopLastSentence,
          curValue: curLoopCurSentence*/
      } : (type === "replaced" && lastSentence && curSentence) ? {
        posLastStart: states.posLastStart,
        posLastEnd: states.posLastStart + lastSentence.value.length +1, // +1 = DOT
        posCurStart: states.posCurStart,
        posCurEnd: states.posCurStart + curSentence.value.length +1, // +1 = DOT

        lastValue: lastSentence,
        curValue: curSentence
      } : { error: "Type not found!" }
    );
  }

  _compairSentenceAdd(sentenceCurTextObj) {
    this._compairMemory.processingCompair.results.push(
      this._createCompairResult("extended", null, sentenceCurTextObj)
    );
  }
  _compairSentenceRemove(sentenceLastTextObj) {
    this._compairMemory.processingCompair.results.push(
      this._createCompairResult("removed", sentenceLastTextObj, null)
    );
  }

  _compairSentenceMove(sentenceTextObj, sideKey, otherSenteceObj) {
    this._updateTextPendingList(sentenceTextObj, sideKey, otherSenteceObj); // Verarbeite Target-Side Satz
  }
  _compairSentenceReplace(sentenceLastTextObj, sentenceCurTextObj) {
    this._compairMemory.processingCompair.results.push(
      this._createCompairResult("replaced", sentenceLastTextObj, sentenceCurTextObj)
    );
  }

  _compairSingleSide(sideKey, otherSideLastSentence) { // für die Seite die als einzige übrige Sätze
    let TextCompairScope = this;
    let targetTextSideMemory = this._compairMemory.textMemory[sideKey];
    //let otherSideCharCount = this._compairMemory.textMemory[(sideKey === "last")?"current":"last"].textProcessedCount;

    let sideSentencesLeftList = targetTextSideMemory.textSentencesList.slice(targetTextSideMemory.textIndex);

    sideSentencesLeftList.forEach( (curSentenceObj) => {// Verwende nur die übrigen Sätze der Seite
      //textIndex, textProcessedCount, textSentencesList

      let otherSideKey = (sideKey === "current") ? "last" : "current";
      let targetPendingIndex = TextCompairScope._findTextInPendingList(curSentenceObj, otherSideKey);

      if (targetPendingIndex >= 0) { // is pending???
        TextCompairScope._updateTextPendingList(curSentenceObj, sideKey, otherSideLastSentence);
      } else {
        if (sideKey === "current")
          TextCompairScope._compairSentenceAdd(curSentenceObj);
        else
          TextCompairScope._compairSentenceRemove(curSentenceObj);
      }
    });
  }

  _processDiffernce(curLoopLastSentence, curLoopCurSentence) {
    let curLoopLastSentenceFound = this._compairMemory.textMemory.current.textSentencesList.findIndex( // finde curLoopLastSentence.value in curTextSentencesList
      (curSent) => curSent.value === curLoopLastSentence.value
    );
    let curLoopCurSentenceFound = this._compairMemory.textMemory.last.textSentencesList.findIndex( // finde curLoopCurSentence.value in lastTextSentencesList
      (curSent) => curSent.value === curLoopCurSentence.value
    );

    let isCurLoopLastSentenceFound = curLoopLastSentenceFound >= 0;
    let isCurLoopCurSentenceFound = curLoopCurSentenceFound >= 0;

    if (!isCurLoopLastSentenceFound && !isCurLoopCurSentenceFound) { // Beide Sätze wurden auf der anderen Seite nirgendwo gefunden...
      this._compairSentenceReplace(curLoopLastSentence, curLoopCurSentence);
      this._compairMemory.textMemory.last.textProcessedCount += curLoopLastSentence.value.length +2; // Add length to lengthCounter
      this._compairMemory.textMemory.current.textProcessedCount += curLoopCurSentence.value.length +2; // Add length to lengthCounter
    } else { // Wenn nur einer der beiden Sätze, auf der gegenüber liegenden Seite, gefunden wurde...

      // check Last side
      if (isCurLoopLastSentenceFound) { // AlterSatz wurde in der AktuellenSätze-Liste gefunden
        if (isCurLoopCurSentenceFound)
          this._compairSentenceMove(curLoopCurSentence, "current", curLoopLastSentence)
      } else {
        this._compairSentenceRemove(curLoopLastSentence);
        this._compairMemory.textMemory.current.textIndex--; // CurrentSentence CurrentLoop repeat
        this._compairMemory.textMemory.last.textProcessedCount += curLoopLastSentence.value.length +2; // Add length to lengthCounter
      }

      // check Current side
      if (isCurLoopCurSentenceFound) { // AlterSatz wurde in der AktuellenSätze-Liste gefunden
        if (isCurLoopLastSentenceFound)
          this._compairSentenceMove(curLoopLastSentence, "last", curLoopCurSentence)
      } else {
        this._compairSentenceAdd(curLoopCurSentence);
        this._compairMemory.textMemory.last.textIndex--; // LastSentence CurrentLoop repeat
        this._compairMemory.textMemory.current.textProcessedCount += curLoopCurSentence.value.length +2; // Add length to lengthCounter
      }
    }

    this._compairMemory.textMemory.last.textIndex++;
    this._compairMemory.textMemory.current.textIndex++;

    /*if (isCurLoopLastSentenceFound && !isCurLoopCurSentenceFound) { // CurText hat ein neuen Satz
      this._compairSentenceAdd();
    } else if (!isCurLoopCurSentenceFound && isCurLoopLastSentenceFound) { // CurText hat einen gelöschten Satz
      this._compairSentenceRemove()
    } else if (isCurLoopLastSentenceFound && isCurLoopCurSentenceFound) { // verschoben (with pending)
      this._compairSentenceMove();
    } else if (!isCurLoopCurSentenceFound && !isCurLoopLastSentenceFound) { // ersetzt
      this._compairSentenceReplace()
    } else debugger;


    loopLastTextProcessedCount += curLoopLastSentence.value.length +1; // Dot on end
    loopCurTextProcessedCount += curLoopCurSentence.value.length +1; // Dot on end*/
  }

  doCompair(lastTextStr, curTextStr) {
    if (!lastTextStr) debugger;

    if (lastTextStr && !curTextStr)
      return [{
        type: "removed",
        posLastStart: 0,
        posLastEnd: lastTextStr.length,
        posCurStart: 0,

        lastValue: lastTextStr,
      }];

    let lastTextSentencesList = TextCompairUtils.sentencesSplit(lastTextStr);
    let curTextSentencesList = TextCompairUtils.sentencesSplit(curTextStr);

    this._compairMemory.processingCompair.results = [];
    this._compairMemory.textMemory.last.textSentencesList = lastTextSentencesList;
    this._compairMemory.textMemory.current.textSentencesList = curTextSentencesList;

    while (!this._compairMemory.loopFinish) {

      let lastSentenceIndex = this._compairMemory.textMemory.last.textIndex;
      let curSentenceIndex = this._compairMemory.textMemory.current.textIndex;
      let curLoopLastSentence = lastTextSentencesList[lastSentenceIndex];
      let curLoopCurSentence = curTextSentencesList[curSentenceIndex];

      if(!curLoopLastSentence || !curLoopCurSentence) debugger;

      if (curLoopLastSentence.value.toLowerCase() === curLoopCurSentence.value.toLowerCase()) { // Kein Unterschied gefunden
        this._compairMemory.textMemory.last.textProcessedCount += curLoopLastSentence.value.length +2; // Dot on end
        this._compairMemory.textMemory.current.textProcessedCount += curLoopCurSentence.value.length +2; // Dot on end
        this._compairMemory.textMemory.last.textIndex++;
        this._compairMemory.textMemory.current.textIndex++;
      } else { // Analysiere den Unterschied
        this._processDiffernce(curLoopLastSentence, curLoopCurSentence);
      }

      // Prüfe ob beide Listen noch Items verfügbar sind
      if (this._compairMemory.textMemory.last.textIndex >= lastTextSentencesList.length
      ||  this._compairMemory.textMemory.current.textIndex >= curTextSentencesList.length
      ) { //if (loopLastTextIndex !== loopCurTextIndex) { // Wenn eine Liste leer ist
        let leftLastTextCount = lastTextSentencesList.length -1 - lastSentenceIndex;
        let leftCurTextCount = curTextSentencesList.length -1 - curSentenceIndex;
        let isLastClear = leftLastTextCount <= 0;
        let isCurClear = leftCurTextCount <= 0;

        if (isLastClear !== isCurClear && (isLastClear || isCurClear)) {
          /*let resultMemory = this._compairMemory.processingCompair.results;
          this._compairMemory.processingCompair.results = resultMemory.concat( // Verbinde gefundene Unterschiede*/
          this._compairSingleSide( // Ermittle alle Unterschiede der übrigen Seite
            (isLastClear) ? "current" : "last",
            (isLastClear) ? curLoopLastSentence : curLoopCurSentence
          )
          //);
        }

        this._compairMemory.loopFinish = true;
      }
    }

    return this._compairMemory.processingCompair.results;
  }
}

let getTextCompair = null;
if (compileMode === 'nodejs') {
  exports.class = TextCompair;
  exports.utils = TextCompairUtils;
} else if (compileMode === 'browser') {
  getTextCompair = function(strLast, strCurrent) {
    let compair = new TextCompair();
    debugger;
    return compair.doCompair(strLast, strCurrent);
  };
}
