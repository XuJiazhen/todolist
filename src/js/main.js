var TODO = TODO || {};
//在添加一个属性或者创建一个命名空间之前，先检查其是否已经存在
TODO.namespace = function (ns_string) {
  //利用“.”号将参数分割成一个数组
  var parts = ns_string.split('.');
  //获取全局变量
  var parent = TODO;
  //剥离冗余的全局变量
  if (parts[0] === 'TODO') {
    parts = parts.slice(1);
  }
  //如果不存在，则创建一个对象，但如果我想创建一个属性呢？岂不是也要变成一个对象
  for (var i=0; i<parts.length; i++) {
    if (typeof parent[parts[i]] === 'undefined') {
      parent[parts[i]] = {};
    }
    parent = parent[parts[i]];
  }
  return parent;
};
//应用初始化
TODO.namespace('TODO.AppInit');
TODO.AppInit = ({
  addBtn: document.getElementById('addBtn'),
  //unfinished: document.getElementById('unfinished'),
  taskInfo: document.getElementById('taskInfo'),

  init: function() {  
    this.addBtn.addEventListener('click', function (event) {
      TODO.createTask(event);
    });
    //this.unfinished.addEventListener('click', function (event) {
    //TODO.moveTask2Finished(event);
    //});
    this.taskInfo.addEventListener('keyup', function (event) {
      if (event.keyCode == 13) {
        TODO.createTask(event);
      }
    });
  }
}).init();
//功能：数据库模块
TODO.namespace('TODO.Utils.database');
TODO.Utils.database = (function (dbName, version) {
  var dbResult;
  var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
  var dbOpenRequest = indexedDB.open(dbName, version);

  //监听数据库打开失败
  dbOpenRequest.onerror = function() {
    console.log('数据库打开失败！');

    return;
  };

  //监听数据库打开成功
  dbOpenRequest.onsuccess = function() {
    console.log('数据库打开成功！');
    //保存数据库内容
    dbResult = dbOpenRequest.result;
    //页面重载时显示数据库内容
    TODO.Utils.database.show();

    return;
  };

  //监听数据库更新
  dbOpenRequest.onupgradeneeded = function(event) {
    var dbResult = event.target.result;
    //创建存储数据的对象仓库
    var objectStore = dbResult.createObjectStore(dbName, {
      keyPath: 'id',
      autoIncrement: true
    });
    //创建数据项（字段/键）
    objectStore.createIndex('id', 'id', { unique: true });
    objectStore.createIndex('description', 'description');
    objectStore.createIndex('status', 'status');
  };

  return {
    //添加数据
    add: function(newItem) {
      var transaction = dbResult.transaction([dbName], 'readwrite');
      var objectStore = transaction.objectStore(dbName);
      var request = objectStore.add(newItem);

      request.onsuccess = function() {
        console.log('添加数据成功！');
      };

      return;
    },
    //删除数据
    del: function(id) {
      var transaction = dbResult.transaction([dbName], 'readwrite');
      var objectStore = transaction.objectStore(dbName);
      var request = objectStore.delete(id);

      request.onsuccess = function() {
        console.log('删除数据成功！');
      };

      return;
    },
    //修改数据
    edit: function(id, data) {
      var transaction = dbResult.transaction([dbName], 'readwrite');
      var objectStore = transaction.objectStore(dbName);
      var request = objectStore.get(id);
      var record;

      request.onsuccess = function() {
        //取得数据项
        record = request.result;
        for (var key in data) {
          if (typeof record[key] != 'undefined') {
            record[key] = data[key];
          }
        }
        objectStore.put(record);
      };

      return;
    },
    show: function() {
      var dataList = [];
      var transaction = dbResult.transaction(dbName);
      var objectStore = transaction.objectStore(dbName);
      var request = objectStore.openCursor();
      var cursor;
      var unfiData = [];
      var fiData = [];

      request.onsuccess = function(event) {
        cursor = event.target.result;
        if (cursor) {
          dataList.push(cursor.value);
          cursor.continue();
        } else {
          for (var i=0; i<dataList.length; i++) {
            if (dataList[i].status === 'unfinished') {
              unfiData.push(dataList[i]);
            } else if(dataList[i].status === 'finished') {
              fiData.push(dataList[i]);
            }
          }
          TODO.reloadUnFiTask(unfiData);
          TODO.reloadFiTask(fiData);
          if (dataList == '') {
            console.log('未找到数据！请添加任务');
          }
        }
      };

      return;
    },
    showResult: function() {
      return dbResult;
    }
  };
}('todolist', 1));
//功能：创建Span标签
TODO.createSpan = function (name) {
  var span = document.createElement('span');
  //var spanText = document.createTextNode('\u00D7');

  span.className = name;
  //span.appendChild(spanText);

  return span;
};
//功能：创建任务项
TODO.createTask = function () {
  var unfinished = document.getElementById('unfinished');
  var taskInfo = document.getElementById('taskInfo').value;
  var taskText = document.createTextNode(taskInfo);
  var li = document.createElement('li');
  var edit = TODO.createSpan('edit');
  var selected = TODO.createSpan('selected');
  var close = TODO.createSpan('close');
  var p = document.createElement('p');

  p.appendChild(taskText);
  li.appendChild(p);
  li.appendChild(edit);
  li.appendChild(selected);
  li.appendChild(close);
  edit.addEventListener('click', TODO.editTask);
  selected.addEventListener('click', TODO.moveTask2Finished);
  close.addEventListener('click', TODO.removeTask);
  if (taskInfo == '') {
    alert('请填写任务信息！');
  } else {
    TODO.Utils.database.add({
      description: taskInfo,
      status: 'unfinished'
    });

    TODO.addDataID2Item(li);
    unfinished.appendChild(li);
    TODO.unfinishedCount();
    document.getElementById('taskInfo').value = '';
  }

  return;
};
//功能：给任务项添加data-id属性，与数据库中本条数据的id想对应，方便后续识别具体任务
TODO.addDataID2Item = function (item) {
  var newDataList = [];
  var dbResult = TODO.Utils.database.showResult();
  var transaction = dbResult.transaction('todolist');
  var objectStore = transaction.objectStore('todolist');
  var request = objectStore.openCursor();
  var cursor;
  var id = null;

  request.onsuccess = function(event) {
    cursor = event.target.result;
    if (cursor) {
      newDataList.push(cursor.value);
      cursor.continue();
    } else {
      for (var i=0; i<newDataList.length; i++) {
        id = newDataList[i].id;
      }
      item.setAttribute('data-id', id);
    }
  };

  return;
};
//功能：移动未完成任务至完成任务区域，并修改数据库中的status为finished，方便重载数据
TODO.moveTask2Finished = function (event) {
  var parent = event.target.parentNode;
  var unfinished = document.getElementById('unfinished');
  var finished = document.getElementById('finished');
  var id;
  var finishedTask;

  if (parent.tagName === 'LI') {
    id = parent.getAttribute('data-id');
    finishedTask = unfinished.removeChild(parent);
    parent.classList.toggle('checked');
    finished.appendChild(finishedTask);
    parent.removeChild(parent.getElementsByClassName('selected')[0]);
    parent.removeChild(parent.getElementsByClassName('edit')[0]);
    TODO.unfinishedCount();
    TODO.finishedCount();
    TODO.Utils.database.edit(parseInt(id), {status: 'finished'});
  }

  return;
};
//功能：从页面和数据库中删除任务信息
TODO.removeTask = function (event) {
  var target = event.target;
  var parent = target.parentNode;
  var dataId = parent.getAttribute('data-id');

  parent.parentNode.removeChild(parent);
  TODO.unfinishedCount();
  TODO.finishedCount();
  TODO.Utils.database.del(parseInt(dataId));

  return;
};
//功能：未完成任务统计
TODO.unfinishedCount = function () {
  var unfinished = document.getElementById('unfinished');
  var lists = unfinished.childNodes;
  var begin = document.getElementById('begin');

  begin.firstChild.nodeValue = lists.length;

  return;
};
//功能：已完成任务统计
TODO.finishedCount = function () {
  var finished = document.getElementById('finished');
  var lists = finished.childNodes;
  var over = document.getElementById('over');

  over.firstChild.nodeValue = lists.length;

  return;
};
//功能：未完成任务区域重载
TODO.reloadUnFiTask = function (dataList) {
  var unfinished = document.getElementById('unfinished');
  var li;
  var taskInfo;
  var close, selected, edit;
  var id;
  var p;

  for (var i=0; i<dataList.length; i++) {
    li = document.createElement('li');
    taskInfo = document.createTextNode(dataList[i].description);
    edit = TODO.createSpan('edit');
    selected = TODO.createSpan('selected');
    close = TODO.createSpan('close');
    id = dataList[i].id;
    
    li.setAttribute('data-id', id);
    p = document.createElement('p');
    p.appendChild(taskInfo);
    li.appendChild(p);
    li.appendChild(edit);
    li.appendChild(selected);
    li.appendChild(close);
    edit.addEventListener('click', TODO.editTask);
    selected.addEventListener('click', TODO.moveTask2Finished);
    close.addEventListener('click', TODO.removeTask);
    unfinished.appendChild(li);
    TODO.unfinishedCount();
  }

  return;
};
//功能：已完成任务区域重载
TODO.reloadFiTask = function (dataList) {
  var finished = document.getElementById('finished');
  var li;
  var taskInfo;
  var span;
  var id;

  for (var i=0; i<dataList.length; i++) {
    li = document.createElement('li');
    taskInfo = document.createTextNode(dataList[i].description);
    span = TODO.createSpan('close');
    id = dataList[i].id;

    li.setAttribute('data-id', id);
    li.appendChild(taskInfo);
    li.appendChild(span);
    span.addEventListener('click', TODO.removeTask);
    finished.appendChild(li);
    li.classList.toggle('checked');
    TODO.finishedCount();
  }

  return;
}; 
//功能：编辑任务信息
TODO.editTask = function (event) {
  var parent = event.target.parentNode;
  var task = parent.getElementsByTagName('p')[0];
  var taskInfo = task.innerHTML;
  var id = parent.getAttribute('data-id');
  var input;

  task.innerHTML = '<input id="input-'+id+'" value="'+taskInfo+'" />';
  input = document.getElementById('input-'+id);
  input.setSelectionRange(0,input.value.length);
  input.focus();
  input.onblur = function () {
    if (input.value === '') {
      task.innerHTML = taskInfo;
      alert('内容不能为空');
    } else {
      task.innerHTML = input.value;
      TODO.Utils.database.edit(parseInt(id), {description: input.value});
    }
  };

  return;
};
