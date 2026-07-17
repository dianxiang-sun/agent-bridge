# Phase 0A evidence harness(纸面准备包;NOT_RUN)

`docs/phase0a-runbook.md` 的配套校验骨架。**本目录不执行任何探测**——只组装/校验
NOT_RUN evidence 与谓词逻辑(不调 Desktop、不跑 `claude -p`、不连真实 MCP、零计费)。
SSOT:evidence schema/pass 谓词/消费门=`docs/v3-protocol-spec.md` §14;执行细则=runbook。

## 文件

| 文件 | 作用(spec/runbook 锚) |
|---|---|
| `ab_canon.py` | AB-CANON-1 原语(spec §1.4);**不 import `docs/gen_golden_vectors.py`**(其 import 即打印);`self_check()` 重算 GV-1/GV-4 锚证明逻辑等价 |
| `evidence.py` | ProbeEvidence 封闭 schema+exact-shape CHECK 1/2(spec §14.2 逐字;义务①)+13 字段 hash-input |
| `predicates.py` | 每探测项封闭布尔 passPredicate(spec §14.3 逐项;义务⑤)+公共强制项+派生布尔重算(P0A-9/P0A-CB 派生非自报) |
| `extract.py` | artifact→observedStateSequence 确定性重抽(runbook 附录 A 同表;义务③)+P0A-CB carrier tuple 专项重抽 |
| `validate.py` | CLI 全链:shape→digest 重算(义务②)→**模板绑定**(expected 必须=注册变体)→artifact 重抽比对+**env_snapshot↔evidence 绑定+隔离门**(PASS⇒isolated_profile)→谓词⇔status(exact-shape 3)→`--consume` 消费门(义务④,allowlist 封闭 schema);**CLI 严格解析**(未知/重复/缺值 option=exit 2);fail-closed |
| `gen_not_run.py` | 生成 10 份 NOT_RUN evidence(本阶段唯一合法产出);`--check` 防 fixtures 漂移 |
| `expected_templates.json` | expectedStateSequence 模板 SSOT(runbook 附录 B) |
| `allowlist.json` | 消费门配置——交付态 fail-closed(approved=[]、frozenHostMatrix=null) |
| `selftest.py` | 义务⑥:**十项各一**合成正例全链+负例变异全拒(含 r82b 攻击向量回归)+CLI subprocess 集成+消费门双向+GV 锚 |
| `fixtures/not_run/` | 10 份 NOT_RUN evidence(gen_not_run.py 产出) |

## 运行

```sh
cd scripts/phase0a
python3 selftest.py                 # 全套自测(应 SELFTEST PASS)
python3 gen_not_run.py --check      # fixtures 漂移检查
python3 validate.py fixtures/not_run/P0A-1.json          # 单份校验
python3 validate.py <evidence.json> --artifact-dir <dir> --consume   # 消费门(交付态恒拒)
```

仅依赖 python3 stdlib;不在 `bun run check` CI 门内(探测期工具,非运行时代码)。

## 纪律

- status 由 `validate.py` 判定(PASS⇔谓词),人工直填 PASS 一律拒收(runbook §0.1)。
- 真实探测执行前:用户按 runbook §11 run card 逐项批准;计费敏感项(P0A-4/5/6/7)不因既往授权自动执行。
- 消费门解锁=用户显式改 `allowlist.json`(approved runbook 版本+冻结 hostMatrix),默认恒拒。
