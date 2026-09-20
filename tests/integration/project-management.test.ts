import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';

// Mock wx-server-sdk
interface DocRecord {
  _id: string;
  [key: string]: any;
}

class MockCollection {
  name: string;
  docs: DocRecord[] = [];

  constructor(name: string) {
    this.name = name;
  }

  where(query: any) {
    return new MockQuery(this, query);
  }

  doc(id: string) {
    return new MockDocRef(this, id);
  }

  async add({ data }: { data: any }) {
    const _id = data._id || `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const doc = { ...data, _id };
    this.docs.push(doc);
    return { _id };
  }
}

class MockQuery {
  col: MockCollection;
  query: any;

  constructor(col: MockCollection, query: any) {
    this.col = col;
    this.query = query;
  }

  orderBy() {
    return this;
  }

  limit() {
    return this;
  }

  private matches(doc: any): boolean {
    for (const key of Object.keys(this.query)) {
      if (doc[key] !== this.query[key]) return false;
    }
    return true;
  }

  async get() {
    const filtered = this.col.docs.filter((d) => this.matches(d));
    return { data: JSON.parse(JSON.stringify(filtered)) };
  }

  async update({ data }: { data: any }) {
    let count = 0;
    for (const d of this.col.docs) {
      if (this.matches(d)) {
        Object.assign(d, data);
        count++;
      }
    }
    return { stats: { updated: count } };
  }

  async remove() {
    const before = this.col.docs.length;
    this.col.docs = this.col.docs.filter((d) => !this.matches(d));
    return { stats: { removed: before - this.col.docs.length } };
  }
}

class MockDocRef {
  col: MockCollection;
  id: string;

  constructor(col: MockCollection, id: string) {
    this.col = col;
    this.id = id;
  }

  async get() {
    const doc = this.col.docs.find((d) => d._id === this.id);
    return { data: doc ? JSON.parse(JSON.stringify(doc)) : null };
  }

  async update({ data }: { data: any }) {
    const doc = this.col.docs.find((d) => d._id === this.id);
    if (!doc) throw new Error('Not found');
    Object.assign(doc, data);
    return { stats: { updated: 1 } };
  }

  async remove() {
    const idx = this.col.docs.findIndex((d) => d._id === this.id);
    if (idx >= 0) {
      this.col.docs.splice(idx, 1);
      return { stats: { removed: 1 } };
    }
    return { stats: { removed: 0 } };
  }
}

const mockCollections: Record<string, MockCollection> = {};
function getCol(name: string) {
  if (!mockCollections[name]) {
    mockCollections[name] = new MockCollection(name);
  }
  return mockCollections[name];
}

import Module from 'node:module';

let currentContext = { OPENID: 'user_proj_1', REQUESTID: 'req_1' };

const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock_env',
  init: () => {},
  getWXContext: () => currentContext,
  database: () => ({
    collection: (name: string) => getCol(name),
    command: {
      in: (arr: any[]) => ({ $in: arr }),
      inc: (n: number) => ({ $inc: n }),
    },
    serverDate: () => Date.now(),
  }),
};

const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === 'wx-server-sdk') {
    return mockSdk;
  }
  return originalRequire.apply(this, [id, ...args]);
};

describe('Project Management Backend API (Section 05)', () => {
  let main: any;

  beforeEach(() => {
    Object.keys(mockCollections).forEach((k) => delete mockCollections[k]);
    currentContext = { OPENID: 'user_proj_1', REQUESTID: 'req_1' };

    const cloudPath = path.resolve(__dirname, '../../cloudfunctions/api/index.js');
    delete require.cache[require.resolve(cloudPath)];
    const mod = require(cloudPath);
    main = mod.main;
  });

  it('支持新建工程项目 (createProject)', async () => {
    const res = await main(
      {
        action: 'createProject',
        payload: {
          name: '四旋翼无人机机身排料',
          description: '碳纤维板排料工程',
          partGroups: [{ id: 'p1', name: '机臂', targetWidth: 200, targetHeight: 30, quantity: 4 }],
        },
      },
      {}
    );

    expect(res.code).toBe(200);
    expect(res.data.projectId).toBeDefined();
    expect(res.data.project.name).toBe('四旋翼无人机机身排料');
  });

  it('支持项目列表查询 (listProjects) 与详情读取 (getProject)', async () => {
    const createRes = await main(
      {
        action: 'createProject',
        payload: { name: '手工作品A' },
      },
      {}
    );
    const projId = createRes.data.projectId;

    const listRes = await main({ action: 'listProjects', payload: {} }, {});
    expect(listRes.code).toBe(200);
    expect(listRes.data.length).toBe(1);
    expect(listRes.data[0]._id).toBe(projId);

    const getRes = await main({ action: 'getProject', payload: { projectId: projId } }, {});
    expect(getRes.code).toBe(200);
    expect(getRes.data.name).toBe('手工作品A');
  });

  it('保存工程内容并阻止其他用户读取或覆盖私人项目', async () => {
    const createRes = await main({
      action: 'createProject',
      payload: { name: '私人纸模', partGroups: [] },
    }, {});
    const projectId = createRes.data.projectId;
    const ownSave = await main({
      action: 'saveProject',
      payload: {
        projectId,
        partGroups: [{ id: 'wing', name: '机翼', targetWidth: 800, targetHeight: 300, quantity: 2 }],
        settings: { kerfMm: 1 },
      },
    }, {});
    expect(ownSave.code).toBe(200);

    currentContext = { OPENID: 'other_user', REQUESTID: 'req_other' };
    const foreignRead = await main({ action: 'getProject', payload: { projectId } }, {});
    const foreignSave = await main({
      action: 'saveProject',
      payload: { projectId, name: '恶意覆盖' },
    }, {});
    expect(foreignRead.code).toBe(404);
    expect(foreignSave.code).toBe(404);
  });

  it('支持复制工程项目 (copyProject) 与重命名 (renameProject)', async () => {
    const createRes = await main(
      {
        action: 'createProject',
        payload: { name: '原版设计' },
      },
      {}
    );
    const origId = createRes.data.projectId;

    const copyRes = await main(
      {
        action: 'copyProject',
        payload: { projectId: origId, newName: '改进版设计' },
      },
      {}
    );
    expect(copyRes.code).toBe(200);
    expect(copyRes.data.projectId).not.toBe(origId);
    expect(copyRes.data.project.name).toBe('改进版设计');

    const renameRes = await main(
      {
        action: 'renameProject',
        payload: { projectId: copyRes.data.projectId, name: '最终定稿' },
      },
      {}
    );
    expect(renameRes.code).toBe(200);

    const getRes = await main(
      {
        action: 'getProject',
        payload: { projectId: copyRes.data.projectId },
      },
      {}
    );
    expect(getRes.data.name).toBe('最终定稿');
  });

  it('支持删除工程项目 (deleteProject)', async () => {
    const createRes = await main(
      {
        action: 'createProject',
        payload: { name: '废弃草稿' },
      },
      {}
    );
    const id = createRes.data.projectId;

    const delRes = await main({ action: 'deleteProject', payload: { projectId: id } }, {});
    expect(delRes.code).toBe(200);

    const listRes = await main({ action: 'listProjects', payload: {} }, {});
    expect(listRes.data.length).toBe(0);
  });
});
