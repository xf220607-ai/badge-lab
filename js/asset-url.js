// 统一处理部署路径。data/blob URL 用于用户上传和抠图结果，必须保持原样。
const BASE_URL = import.meta.env.BASE_URL;
const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export function withAssetBase(path) {
  if (!path || EXTERNAL_URL.test(path) || path.startsWith(BASE_URL)) return path;
  return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}
