/*jslint indent: 2, unparam: true*/
/*global document: false, MutationObserver: false, chrome: false, window: false*/
"use strict";

function $(s, elem) {
  elem = elem || document;
  return elem.querySelector(s);
}

function createTag(name, className, innerHTML) {
  var tag = document.createElement(name);
  tag.className = className;

  if (innerHTML) {
    tag.innerHTML = innerHTML;
  }

  return tag;
}

function createLink(className, tagName, linkHref) {
  var link;

  // Param defaults
  tagName  = tagName  || 'a';
  linkHref = linkHref || '#';
  link     = createTag(tagName, className);

  if (tagName === 'a') {
    link.href = linkHref;
  }

  link.appendChild(document.createTextNode('Start timer'));
  return link;
}

function invokeIfFunction(trial) {
  if (trial instanceof Function) {
    return trial();
  }
  return trial;
}

var togglbutton = {
  isStarted: false,
  element: null,
  serviceName: '',
  mousedownTrigger: null,
  projectBlurTrigger: null,
  taskBlurTrigger: null,
  tagsVisible: false,
  hasTasks: false,
  currentDescription: "",
  render: function (selector, opts, renderer) {
    chrome.extension.sendMessage({type: 'activate'}, function (response) {
      if (response.success) {
        if (opts.observe) {
          var observer = new MutationObserver(function (mutations) {
            togglbutton.renderTo(selector, renderer);
          });
          observer.observe(document, {childList: true, subtree: true});
        }
        togglbutton.renderTo(selector, renderer);
      }
    });
  },

  renderTo: function (selector, renderer) {
    var i, len, elems = document.querySelectorAll(selector);
    for (i = 0, len = elems.length; i < len; i += 1) {
      elems[i].classList.add('toggl');
    }
    for (i = 0, len = elems.length; i < len; i += 1) {
      renderer(elems[i]);
    }
  },

  getSelectedTags: function () {
    var tags = [],
      tag,
      i,
      s = document.getElementById("toggl-button-tag");
    for (i = 0; i < s.options.length; i += 1) {
      if (s.options[i].selected === true) {
        tag = s.options[i].innerHTML;
        tags.push(tag);
      }
    }
    return tags;
  },

  delegateTaskClick: function (e) {
    // Ignore this click if it caused the last task blur.
    if (togglbutton.taskBlurTrigger === e.target) {
      togglbutton.taskBlurTrigger = null;
      return;
    }

    var dropdown = document.getElementById('toggl-button-task'),
      event = document.createEvent('MouseEvents');
    event.initMouseEvent('mousedown', true, true, window);
    dropdown.dispatchEvent(event);
  },


  resetTasks: function () {
    $("#toggl-button-task-placeholder").removeEventListener('click', togglbutton.delegateTaskClick);
    $("#toggl-button-task-placeholder > div").innerHTML = "Add task";
    $("#toggl-button-task").innerHTML = "";
  },

  addEditForm: function (response) {
    togglbutton.hasTasks = response.hasTasks;
    if (response === null || !response.showPostPopup) {
      return;
    }
    var pid = (!!response.entry.pid) ? response.entry.pid : 0,
      projectSelect,
      handler,
      left,
      top,
      editFormHeight = 350,
      editFormWidth = 240,
      submitForm,
      taskSelect,
      updateTags,
      closeTagsList,
      elemRect,
      div = document.createElement('div'),
      editForm;

    elemRect = togglbutton.element.getBoundingClientRect();
    editForm = $("#toggl-button-edit-form");

    if (editForm !== null) {
      togglbutton.fetchTasks(pid, editForm);
      $("#toggl-button-description").value = response.entry.description;
      $("#toggl-button-project").value = pid;
      projectSelect = document.getElementById("toggl-button-project");
      $("#toggl-button-project-placeholder > div").innerHTML = (pid === 0) ? "Add project" : projectSelect.options[projectSelect.selectedIndex].text;
      togglbutton.resetTasks();
      $("#toggl-button-tag-placeholder > div", editForm).innerHTML = "Add tags";
      $("#toggl-button-tag").value = "";
      editForm.style.left = (elemRect.left - 10) + "px";
      editForm.style.top = (elemRect.top - 10) + "px";
      editForm.style.display = "block";
      return;
    }

    div.innerHTML = response.html.replace("{service}", togglbutton.serviceName);
    editForm = div.firstChild;
    left = (elemRect.left - 10);
    top = (elemRect.top - 10);
    if (left + editFormWidth > window.innerWidth) {
      left = window.innerWidth - 10 - editFormWidth;
    }
    if (top + editFormHeight > window.innerHeight) {
      top = window.innerHeight - 10 - editFormHeight;
    }
    editForm.style.left = left + "px";
    editForm.style.top = top + "px";
    if (togglbutton.serviceName === "basecamp") {
      editForm.style.position = "fixed";
    }
    document.body.appendChild(editForm);
    togglbutton.fetchTasks(pid, editForm);

    handler = function (e) {
      if (!/toggl-button/.test(e.target.className) && !/toggl-button/.test(e.target.parentElement.className)) {
        closeTagsList(true);
        editForm.style.display = "none";
        this.removeEventListener("click", handler);
      }
    };

    submitForm = function (that) {
      var taskButton = $("#toggl-button-task"),
        request = {
          type: "update",
          description: $("#toggl-button-description").value,
          pid: $("#toggl-button-project").value,
          tags: togglbutton.getSelectedTags(),
          tid: (taskButton && taskButton.value) ? taskButton.value : null
        };
      chrome.extension.sendMessage(request);
      closeTagsList(true);
      editForm.style.display = "none";
    };

    updateTags = function () {
      var tags = togglbutton.getSelectedTags();
      if (tags.length) {
        tags = tags.join(',');
      } else {
        tags = "Add tags";
      }
      $("#toggl-button-tag-placeholder > div", editForm).innerHTML = tags;
    };

    closeTagsList = function (close) {
      var dropdown = document.getElementById('toggl-button-tag');
      if (close) {
        dropdown.style.display = "none";
        togglbutton.tagsVisible = false;
        return;
      }
      if (togglbutton.tagsVisible) {
        dropdown.style.display = "none";
        updateTags();
      } else {
        dropdown.style.display = "block";
      }
      togglbutton.tagsVisible = !togglbutton.tagsVisible;
    };

    $("#toggl-button-description", editForm).value = response.entry.description;
    $("#toggl-button-project", editForm).value = pid;
    projectSelect = $("#toggl-button-project", editForm);
    $("#toggl-button-project-placeholder > div", editForm).innerHTML = (pid === 0) ? "Add project" : projectSelect.options[projectSelect.selectedIndex].text;
    $("#toggl-button-hide", editForm).addEventListener('click', function (e) {
      closeTagsList(true);
      editForm.style.display = "none";
    });

    $("#toggl-button-update", editForm).addEventListener('click', function (e) {
      submitForm(this);
    });

    $("form", editForm).addEventListener('submit', function (e) {
      submitForm(this);
    });

    $(".toggl-button", editForm).addEventListener('click', function (e) {
      var link;
      e.preventDefault();
      link = togglbutton.element;
      link.classList.remove('active');
      link.style.color = '';
      if (!link.classList.contains("min")) {
        link.innerHTML = 'Start timer';
      }
      chrome.extension.sendMessage({type: 'stop'}, togglbutton.addEditForm);
      closeTagsList(true);
      editForm.style.display = "none";
      return false;
    });
    document.addEventListener('mousedown', function (e) {
      togglbutton.mousedownTrigger = e.target;
    });
    document.addEventListener('mouseup', function (e) {
      togglbutton.mousedownTrigger = null;
    });

    $("#toggl-button-project-placeholder", editForm).addEventListener('click', function (e) {
      // Ignore this click if it caused the last project blur.
      if (togglbutton.projectBlurTrigger === e.target) {
        togglbutton.projectBlurTrigger = null;
        return;
      }

      var dropdown = document.getElementById('toggl-button-project'),
        event = document.createEvent('MouseEvents');
      event.initMouseEvent('mousedown', true, true, window);
      dropdown.dispatchEvent(event);
    });

    $("#toggl-button-tag-placeholder", editForm).addEventListener('click', function (e) {
      closeTagsList(false);
    });

    projectSelect.addEventListener('change', function (e) {
      var projectId = this.value;
      $("#toggl-button-project-placeholder > div", editForm).innerHTML = (projectId === "0") ? "Add project" : this.options[this.selectedIndex].text;
      // Force blur.
      togglbutton.projectBlurTrigger = null;
      projectSelect.blur();

      togglbutton.fetchTasks(projectId, editForm);
    });
    projectSelect.addEventListener('click', function () {
      // Catch click in case user selects an already-selected item - force blur.
      togglbutton.projectBlurTrigger = null;
      projectSelect.blur();
    });
    projectSelect.addEventListener('blur', function () {
      togglbutton.projectBlurTrigger = togglbutton.mousedownTrigger;
    });

    taskSelect = $("#toggl-button-task", editForm);
    taskSelect.addEventListener('change', function (e) {
      $("#toggl-button-task-placeholder > div", editForm).innerHTML = (taskSelect.value === "0") ? "Add task" : taskSelect.options[taskSelect.selectedIndex].text;

      // Force blur.
      togglbutton.taskBlurTrigger = null;
      taskSelect.blur();
    });
    taskSelect.addEventListener('click', function () {
      // Catch click in case user selects an already-selected item - force blur.
      togglbutton.taskBlurTrigger = null;
      projectSelect.blur();
    });
    taskSelect.addEventListener('blur', function (e) {
      togglbutton.taskBlurTrigger = togglbutton.mousedownTrigger;
    });

    document.addEventListener("click", handler);
  },

  fetchTasks: function (projectId, editForm) {
    var tasksRow = document.getElementById("toggl-button-tasks-row");
    togglbutton.resetTasks();
    if (!togglbutton.hasTasks || projectId === 0) {
      tasksRow.style.display = "none";
      return;
    }
    // If tasks are available, populate the task dropdown.
    chrome.extension.sendMessage({type: 'getTasksHtml', projectId: projectId}, function (response) {
      if (response && response.success && response.html) {
        $('#toggl-button-task').innerHTML = response.html;
        $("#toggl-button-task-placeholder", editForm).addEventListener('click', togglbutton.delegateTaskClick);
        tasksRow.style.display = "block";
      } else {
        tasksRow.style.display = "none";
      }
    });
  },

  createTimerLink: function (params) {
    var link = createLink('toggl-button');
    togglbutton.currentDescription = invokeIfFunction(params.description);
    function activate() {
      link.classList.add('active');
      link.style.color = '#1ab351';
      if (params.buttonType !== 'minimal') {
        link.innerHTML = 'Stop timer';
      }
    }

    function deactivate() {
      link.classList.remove('active');
      link.style.color = '';
      if (params.buttonType !== 'minimal') {
        link.innerHTML = 'Start timer';
      }
    }

    link.classList.add(params.className);
    togglbutton.serviceName = params.className;

    if (params.buttonType === 'minimal') {
      link.classList.add('min');
      link.removeChild(link.firstChild);
    }

    link.addEventListener('click', function (e) {
      var opts;
      e.preventDefault();

      if (link.classList.contains('active')) {
        deactivate();
        opts = {type: 'stop'};
      } else {
        activate();
        opts = {
          type: 'timeEntry',
          respond: true,
          projectId: invokeIfFunction(params.projectId),
          description: invokeIfFunction(params.description),
          tags: invokeIfFunction(params.tags),
          projectName: invokeIfFunction(params.projectName),
          createdWith: 'TogglButton - ' + params.className
        };
      }
      togglbutton.element = e.target;
      chrome.extension.sendMessage(opts, togglbutton.addEditForm);

      return false;
    });

    // new button created - set state
    chrome.extension.sendMessage({type: 'currentEntry'}, function (response) {
      var description, currentEntry;
      if (response.success) {
        currentEntry = response.currentEntry;
        description = invokeIfFunction(params.description);
        if (description === currentEntry.description) {
          activate(link);
        }
      }
    });

    return link;
  },

  // If "entry" is passed, make button active; otherwise inactive.
  updateTimerLink: function (entry) {
    var linkText = '',
      color = '',
      link = $(".toggl-button"),
      minimal = link.classList.contains("min");
    if (link === null) {
      return;
    }

    if (entry === null || togglbutton.currentDescription !== entry.description) {
      link.classList.remove('active');
      if (!minimal) {
        linkText = 'Start timer';
      }
    } else {
      link.classList.add('active');
      color = '#1ab351';
      if (!minimal) {
        linkText = 'Stop timer';
      }
    }
    link.style.color = color;
    link.innerHTML = linkText;
  },

  newMessage: function (request, sender, sendResponse) {
    if (request.type === 'stop-entry') {
      togglbutton.updateTimerLink();
    } else if (request.type === 'sync') {
      if ($("#toggl-button-edit-form") !== null) {
        $("#toggl-button-edit-form").remove();
      }
    }
  }
};

chrome.extension.onMessage.addListener(togglbutton.newMessage);
window.addEventListener('focus', function (e) {
  // update button state
  chrome.extension.sendMessage({type: 'currentEntry'}, function (response) {
    togglbutton.updateTimerLink(response.currentEntry);
  });
});