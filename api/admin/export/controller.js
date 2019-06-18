const log = require('log')('app:admin');
const Router = require('koa-router');
const _ = require('lodash');
const auth = require('../../auth/auth');
const service = require('./service');
const communityService = require('../../community/service');

var router = new Router();

router.get('/api/admin/export', auth.isAdmin, async (ctx, next) => {
  if(ctx.state.user.isAdmin) {
    await service.getExportData('user').then(results => {
      ctx.response.set('Content-Type', 'text/csv');
      ctx.response.set('Content-disposition', 'attachment; filename=users.csv');
      ctx.body = results;
      service.createAuditLog('DATA_EXPORTED', ctx, {
        userId: ctx.state.user.id,
        action: 'Sitewide user data exported.',
      });
    }).catch(err => {
      log.info(err);
      ctx.status = 500;
    });
  } else {
    service.createAuditLog('FORBIDDEN_ACCESS', ctx, {
      userId: ctx.state.user.id,
      path: ctx.path,
      method: ctx.method,
      status: 'blocked',
    });
    ctx.status = 403;
  }
});

router.get('/api/admin/export/agency/:id', auth.isAdminOrAgencyAdmin, async (ctx, next) => {
  if(ctx.state.user.isAdmin || ctx.state.user.agencyId == ctx.params.id) {
      await service.getExportData('user', 'agency', ctx.params.id).then(rendered => {
      ctx.response.set('Content-Type', 'text/csv');
      ctx.response.set('Content-disposition', 'attachment; filename=agency_users.csv');
      ctx.body = rendered;
      service.createAuditLog('DATA_EXPORTED', ctx, {
        userId: ctx.state.user.id,
        action: 'User data exported for agency id ' + ctx.params.id,
      });
    }).catch(err => {
      log.info(err);
      ctx.status = 500;
    });
  } else {
    service.createAuditLog('FORBIDDEN_ACCESS', ctx, {
      userId: ctx.state.user.id,
      path: ctx.path,
      method: ctx.method,
      status: 'blocked',
    });
    ctx.status = 403;
  }
});

router.get('/api/admin/export/community/:id', auth, async (ctx, next) => {
  if(await communityService.isCommunityManager(ctx.state.user, ctx.params.id)) {
    await service.getExportData('user', 'community', ctx.params.id).then(rendered => {
      ctx.response.set('Content-Type', 'text/csv');
      ctx.response.set('Content-disposition', 'attachment; filename=community_users.csv');
      ctx.body = rendered;
      service.createAuditLog('DATA_EXPORTED', ctx, {
        userId: ctx.state.user.id,
        action: 'User data exported for community ' + ctx.params.id,
      });
    }).catch(err => {
      log.info(err);
      ctx.status = 500;
    });
  } else {
    service.createAuditLog('FORBIDDEN_ACCESS', ctx, {
      userId: ctx.state.user.id,
      path: ctx.path,
      method: ctx.method,
      status: 'blocked',
    });
    ctx.status = 403;
  }
});

router.get('/api/admin/task/export', auth.isAdmin, async (ctx, next) => {
  if(ctx.state.user.isAdmin) {
    var exportData = await service.getExportData('task').then(rendered => {
      ctx.response.set('Content-Type', 'text/csv');
      ctx.response.set('Content-disposition', 'attachment; filename=tasks.csv');
      ctx.body = rendered;
      service.createAuditLog('DATA_EXPORTED', ctx, {
        userId: ctx.state.user.id,
        action: 'Sitewide task data exported.',
      });
    }).catch(err => {
      log.info(err);
    });
  } else {
    service.createAuditLog('FORBIDDEN_ACCESS', ctx, {
      userId: ctx.state.user.id,
      path: ctx.path,
      method: ctx.method,
      status: 'blocked',
    });
    ctx.status = 403;
  }
});

router.get('/api/admin/task/export/agency/:id', auth.isAdminOrAgencyAdmin, async (ctx, next) => {
  if(ctx.state.user.isAdmin || ctx.state.user.agencyId == ctx.params.id) {
    await service.getExportData('task', 'agency', ctx.params.id).then(rendered => {
      ctx.response.set('Content-Type', 'text/csv');
      ctx.response.set('Content-disposition', 'attachment; filename=agency_tasks.csv');
      ctx.body = rendered;
      service.createAuditLog('DATA_EXPORTED', ctx, {
        userId: ctx.state.user.id,
        action: 'Task data exported for agency id ' + ctx.params.id,
      });
    }).catch(err => {
      log.info(err);
    });
  } else {
    service.createAuditLog('FORBIDDEN_ACCESS', ctx, {
      userId: ctx.state.user.id,
      path: ctx.path,
      method: ctx.method,
      status: 'blocked',
    });
    ctx.status = 403;
  } 
});

router.get('/api/admin/task/export/community/:id', auth.isAdmin, async (ctx, next) => {
  if(await communityService.isCommunityManager(ctx.state.user, ctx.params.id)) {
    await service.getExportData('task', 'community', ctx.params.id).then(rendered => {
      ctx.response.set('Content-Type', 'text/csv');
      ctx.response.set('Content-disposition', 'attachment; filename=community_tasks.csv');
      ctx.body = rendered;
      service.createAuditLog('DATA_EXPORTED', ctx, {
        userId: ctx.state.user.id,
        action: 'Task data exported for community id ' + ctx.params.id,
      });
    }).catch(err => {
      log.info(err);
    });
  } else {
    service.createAuditLog('FORBIDDEN_ACCESS', ctx, {
      userId: ctx.state.user.id,
      path: ctx.path,
      method: ctx.method,
      status: 'blocked',
    });
    ctx.status = 403;
  }
});

module.exports = router.routes();