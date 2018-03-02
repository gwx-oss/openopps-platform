var $ = require('jquery');
var _ = require('underscore');
var async = require('async');
var Bootstrap = require('bootstrap');
var Backbone = require('backbone');
var i18n = require('i18next');
var i18nextJquery = require('jquery-i18next');
var marked = require('marked');
var TimeAgo = require('../../../../../vendor/jquery.timeago');

var BaseView = require('../../../../base/base_view');
var UIConfig = require('../../../../config/ui.json');
var ModalComponent = require('../../../../components/modal');

var TaskShowTemplate = require('../templates/task_show_item_template.html');
var ProgressTemplate = require('../templates/task_progress_template.html');
var AlertTemplate = require('../../../../components/alert_template.html');
var NextStepTemplate = require('../templates/next_step_template.html');
var RemoveParticipantTemplate = require('../templates/remove_participant_template.html');
var ParticipateCheckList = require('../templates/participate_check_list.html').toString();
var ProfileCheckList = require('../templates/profile_check_list.html');
var ShareTemplate = require('../templates/task_share_template.txt');


var TaskItemView = BaseView.extend({
  events: {
    'click #accept-toggle'          : 'toggleAccept',
    'click #apply'                  : 'apply',
    'click #nextstep'               : 'nextstep',
    'click #complete'               : 'complete',
    'click .project-people__assign' : 'assignParticipant',
    'click .project-people__remove' : 'removeParticipant',
    'click .usa-accordion-button'   : 'toggleAccordion',
    'click .task-complete'          : 'taskComplete',
  },

  modalOptions: {
    el: '#site-modal',
    id: 'volunteer',
    modalTitle: '',
    modalBody: '',
    disableClose: false,
    secondary: { },
    primary: { },
  },

  initialize: function (options) {
    var self = this;
    this.options = options;
    this.model.trigger('task:model:fetch', options.id);
    this.listenTo(this.model, 'task:model:fetch:success', function (model) {
      self.model = model;
      self.initializeTags(self);
    });
    this.listenTo(this.model, 'task:model:fetch:error', function (model, xhr) {
      var template = _.template(AlertTemplate)();
      self.$el.html(template);
    });
  },

  render: function (self) {
    var taskState = self.model.attributes.state;

    if (_.isString(taskState)) {
      taskState = taskState.charAt(0).toUpperCase() + taskState.slice(1);
    }

    self.data = {
      user: window.cache.currentUser,
      model: self.model.toJSON(),
      tags: self.model.toJSON().tags,
      state: {
        humanReadable: taskState,
        value: taskState.toLowerCase(),
      },
      hasStep: this.hasStep.bind(this),
      accordion: {
        show: false,
        open: false,
      },
    };

    if (['in progress', 'completed'].indexOf(taskState.toLowerCase()) > -1) {
      self.data.accordion.show = true;
    }

    self.data['madlibTags'] = organizeTags(self.data.tags);
    self.data.model.descriptionHtml = marked(self.data.model.description || '');
    self.model.trigger('task:tag:data', self.tags, self.data['madlibTags']);

    var d = self.data,
        vol = ((!d.user || d.user.id !== d.model.userId) &&
        (d.model.volunteer || 'open' === d.model.state));

    self.data.ui = UIConfig;
    self.data.vol = vol;
    self.data.model.userId = self.data.model.owner.id;
    var compiledTemplate = _.template(TaskShowTemplate)(self.data);

    self.$el.html(compiledTemplate);
    self.$el.localize();
    $('time.timeago').timeago();
    self.updateTaskEmail();
    self.model.trigger('task:show:render:done');
    this.initializeProgress();
  },

  initializeProgress: function () {
    $('#rightrail').html(_.template(ProgressTemplate)(this.data));
    this.initializeStateButtons();
  },

  initializeStateButtons: function () {
    if(this.data.model.canEditTask) {
      $('#nextstep').hide();
      $('#complete').hide();
      switch (this.model.attributes.state.toLowerCase()) {
        case 'open':
        case 'not open':
          $('#nextstep').show();
          break;
        case 'in progress':
          $('#complete').show();
          break;
      }
    }
  },

  hasStep: function (step) {
    switch (step) {
      case 'assigning':
        return _.contains(['open', 'not open', 'in progress', 'completed'], this.data.state.value);
      case 'inProgress':
        return _.contains(['in progress', 'completed'], this.data.state.value);
      case 'complete':
        return this.data.state.value === 'completed';
      default:
        return false;
    }
  },

  updateTaskEmail: function () {
    var subject = 'Take A Look At This Opportunity',
        data = {
          opportunityTitle: this.model.get('title'),
          opportunityLink: window.location.protocol +
          '//' + window.location.host + '' + window.location.pathname,
          opportunityDescription: this.model.get('description'),
          opportunityMadlibs: $('<div />', {
            html: this.$('#task-show-madlib-description').html(),
          }).text().replace(/\s+/g, ' '),
        },
        body = _.template(ShareTemplate)(data),
        link = 'mailto:?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    this.$('#email').attr('href', link);
  },

  initializeTags: function (self) {
    var types = ['task-skills-required', 'task-time-required', 'task-people', 'task-length', 'task-time-estimate'];

    self.tagSources = {};

    var requestAllTagsByType = function (type, cb) {
      $.ajax({
        url: '/api/ac/tag?type=' + type + '&list',
        type: 'GET',
        async: false,
        success: function (data) {
          self.tagSources[type] = data;
          return cb();
        },
      });
    };

    async.each(types, requestAllTagsByType, function (err) {
      self.model.trigger('task:tag:types', self.tagSources);
      self.render(self);
    });
  },

  toggleAccordion: function (e) {
    var element = $(e.currentTarget);
    this.data.accordion.open = !this.data.accordion.open;
    element.attr('aria-expanded', this.data.accordion.open);
    element.siblings('.usa-accordion-content').attr('aria-hidden', !this.data.accordion.open);
  },

  updatePill: function (state) {
    var pillElem = $('.status-' + this.data.state.value.replace(' ', '-'));
    pillElem.removeClass('status-' + this.data.state.value.replace(' ', '-'));
    this.data.state = {
      humanReadable: state.charAt(0).toUpperCase() + state.slice(1),
      value: state,
    };
    this.data.model.state = state;
    this.model.attributes.state = state;
    pillElem.addClass('status-' + this.data.state.value.replace(' ', '-'));
    pillElem.html(this.data.state.humanReadable);
  },

  toggleAccept: function (e) {
    var toggleOn = $(e.currentTarget).hasClass('toggle-off');
    var state = this.model.attributes.state.toLowerCase();
    if(state == 'open' && !toggleOn) {
      state = 'not open';
    } else if (state == 'not open' && toggleOn) {
      state = 'open';
    }
    $.ajax({
      url: '/api/task/state/' +  this.model.attributes.id,
      type: 'PUT',
      data: {
        id: this.model.attributes.id,
        state: state,
        acceptingApplicants: toggleOn,
      },
      success: function (data) {
        if(toggleOn) {
          $(e.currentTarget).removeClass('toggle-off');
        } else {
          $(e.currentTarget).addClass('toggle-off');
        }
        this.updatePill(state);
      }.bind(this),
      error: function (err) {
        // display modal alert type error
      }.bind(this),
    });
  },

  taskComplete: function (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    var complete = $(e.currentTarget).data('behavior') == 'complete';
    $.ajax({
      url: '/api/volunteer/complete',
      type: 'POST',
      data: {
        taskId: this.model.attributes.id,
        volunteerId: $(e.currentTarget).data('volunteerid'),
        complete: complete,
      },
      success: function (data) {
        _.findWhere(this.data.model.volunteers, { id: data.id }).taskComplete = complete;
        this.initializeProgress();
      }.bind(this),
      error: function (err) {
        // display modal alert type error
      }.bind(this),
    });
  },

  removeParticipant: function (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    if (this.data.state.value == 'in progress') {
      var volunteerid = $(e.currentTarget).data('volunteerid');
      var participant = _.findWhere(this.data.model.volunteers, { id: volunteerid });
      var options = _.extend(_.clone(this.modalOptions), {
        modalTitle: 'Are you sure you want to remove this participant?',
        modalBody: _.template(RemoveParticipantTemplate)(participant),
        secondary: {
          text: 'Cancel',
          action: function () {
            this.modalComponent.cleanup();
          }.bind(this),
        },
        primary: {
          text: 'Confirm',
          action: function () {
            this.modalComponent.cleanup();
            this.assignParticipant(e);
          }.bind(this),
        },
      });
      this.modalComponent = new ModalComponent(options).render();
    } else {
      this.assignParticipant(e);
    }
  },

  assignParticipant: function (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    var assign = $(e.currentTarget).data('behavior') == 'assign';
    $.ajax({
      url: '/api/volunteer/assign',
      type: 'POST',
      data: {
        taskId: this.model.attributes.id,
        volunteerId: $(e.currentTarget).data('volunteerid'),
        assign: assign,
      },
      success: function (data) {
        _.findWhere(this.data.model.volunteers, { id: data.id }).assigned = assign;
        this.initializeProgress();
      }.bind(this),
      error: function (err) {
        // display modal alert type error
      }.bind(this),
    });
  },

  nextstep: function (e) {
    var state = 'in progress';
    $.ajax({
      url: '/api/task/state/' +  this.model.attributes.id,
      type: 'PUT',
      data: {
        id: this.model.attributes.id,
        state: state,
        acceptingApplicants: false,
      },
      success: function (data) {
        this.updatePill(state);
        this.model.attributes.acceptingApplicants = false;
        this.data.model.acceptingApplicants = false;
        this.data.accordion.show = true;
        this.initializeProgress();
        var options = _.extend(_.clone(this.modalOptions), {
          modalTitle: 'Let\'s get started',
          modalBody: NextStepTemplate,
          primary: {
            text: 'Okay',
            action: function () {
              this.modalComponent.cleanup();
            }.bind(this),
          },
        });
        this.modalComponent = new ModalComponent(options).render();
      }.bind(this),
      error: function (err) {
        // display modal alert type error
      }.bind(this),
    });
  },

  complete: function (e) {
    var state = 'completed';
    $.ajax({
      url: '/api/task/state/' +  this.model.attributes.id,
      type: 'PUT',
      data: {
        id: this.model.attributes.id,
        state: state,
        acceptingApplicants: false,
      },
      success: function (data) {
        this.updatePill(state);
        this.model.attributes.acceptingApplicants = false;
        this.data.model.acceptingApplicants = false;
        this.data.accordion.show = true;
        this.initializeProgress();
        var options = _.extend(_.clone(this.modalOptions), {
          modalTitle: 'Congratulations!',
          modalBody: 'You\'ve successfully completed <strong>' + this.model.attributes.title +
            '</strong>. We updated your profile with your achievement. Don\'t forget to thank ' +
            'your participants for a job well done.',
          primary: {
            text: 'Done',
            action: function () {
              this.modalComponent.cleanup();
            }.bind(this),
          },
        });
        this.modalComponent = new ModalComponent(options).render();
      }.bind(this),
      error: function (err) {
        // display modal alert type error
      }.bind(this),
    });
  },

  apply: function (e) {
    if (e.preventDefault) e.preventDefault();
    if (!window.cache.currentUser) {
      window.cache.userEvents.trigger('user:request:login');
    } else {
      var requiredTags = window.cache.currentUser.tags.filter(function (t) {
        return t.type === 'location' || t.type === 'agency';
      });
      if(requiredTags.length < 2) {
        this.completeProfile(requiredTags);
      } else {
        var options = _.extend(_.clone(this.modalOptions), {
          modalTitle: 'Do you want to participate?',
          modalBody: ParticipateCheckList,
          primary: {
            text: 'Yes, submit my name',
            action: this.volunteer.bind(this),
          },
        });
        this.modalComponent = new ModalComponent(options).render();
      }
    }
  },

  completeProfile: function (tags) {
    var options = _.extend(_.clone(this.modalOptions), {
      modalTitle: 'Please complete your profile.',
      modalBody: _.template(ProfileCheckList)({ tags: tags }),
      primary: {
        text: 'Go to profile',
        action: function () {
          this.modalComponent.cleanup();
          Backbone.history.navigate('/profile/' + window.cache.currentUser.id, { trigger: true });
        }.bind(this),
      },
    });
    this.modalComponent = new ModalComponent(options).render();
  },

  volunteer: function () {
    var self = this;
    $.ajax({
      url: '/api/volunteer/',
      type: 'POST',
      data: {
        taskId: self.model.attributes.id,
      },
    }).done( function (data) {
      if(!_.findWhere(self.data.model.volunteers, { userId: data.userId })) {
        self.data.model.volunteers.push(data);
        self.initializeProgress();
      }
      self.modalComponent.cleanup();
    });
  },

  cleanup: function () {
    removeView(this);
  },
});

module.exports = TaskItemView;
