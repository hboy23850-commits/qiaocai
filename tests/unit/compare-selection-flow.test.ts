import { beforeEach, describe, expect, it, vi } from 'vitest';

const callCloudFunction = vi.fn();

vi.mock('../../miniprogram/utils/cloud-adapter', () => ({
  callCloudFunction,
}));
vi.mock('../../miniprogram/utils/cloud-adapter.js', () => ({
  callCloudFunction,
}));

describe('方案确认页面', () => {
  let pageOptions: any;
  let navigateTo: ReturnType<typeof vi.fn>;
  let showToast: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    callCloudFunction.mockReset();
    navigateTo = vi.fn();
    showToast = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    (globalThis as any).Page = vi.fn((options: any) => {
      pageOptions = options;
    });
    (globalThis as any).getApp = vi.fn(() => ({
      globalData: {},
    }));
    (globalThis as any).wx = {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showToast,
      navigateTo,
    };

    await import('../../miniprogram/pages/compare/compare.ts');
    pageOptions.data = {
      candidates: [{ candidateId: 'candidate-1', isComplete: true }],
      planId: 'plan-1',
      hasCompleteCandidate: true,
    };
  });

  it('云端确认抛出异常时不得进入裁切页', async () => {
    callCloudFunction.mockRejectedValueOnce(new Error('network down'));

    await pageOptions.selectCandidate.call(pageOptions, {
      currentTarget: { dataset: { id: 'candidate-1' } },
    });

    expect(navigateTo).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('确认失败') }),
    );
  });

  it('云端返回失败状态时显示服务端消息且不得进入裁切页', async () => {
    callCloudFunction.mockResolvedValueOnce({
      result: { code: 409, msg: '库存版本冲突' },
    });

    await pageOptions.selectCandidate.call(pageOptions, {
      currentTarget: { dataset: { id: 'candidate-1' } },
    });

    expect(navigateTo).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '库存版本冲突' }),
    );
  });
});
