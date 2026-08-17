# Minecraft Java版 26.2 完整参考

## 26.2 新增内容

### 生物群系
- 硫黄洞穴 (Sulfur Caves)

### 生物
- 硫方怪 (Sulfur Cube) – 大型、中型、小型

### 方块与物品
- 硫黄块、錾制硫黄、磨制硫黄、硫黄砖、硫黄楼梯/台阶/墙
- 朱砂块、錾制朱砂、磨制朱砂、朱砂砖、朱砂楼梯/台阶/墙
- 硫黄尖锥、烈性硫黄
- 硫方怪桶、硫方怪刷怪蛋、新音乐唱片

### 新增标签
- 物品标签: `#sulfur_cube_archetype/hot`, `#sulfur_cube_archetype/slow_bouncy`, `#sulfur_cube_archetype/explosive`
- 伤害类型标签: `#sulfur_cube_with_block_immune_to`
- 实体标签: `#not_affected_by_geysers`
- 方块标签: `#fox_immune_to`

### 进度
- "Uh Oh" – 让硫方怪吸收TNT

### 技术更改摘要
- 数据包版本: 106.1, 资源包版本: 88.0, 数据版本: 4894
- 移除生物NBT `HurtByTimestamp`，改用 `ticks_since_last_hurt_by_mob`
- `/execute on owner` 修复恼鬼主人识别
- 新增 `/unpublish` 指令
- 极限模式禁用 `/gamemode`
- 游戏模式联动默认模式
- 反垃圾阈值分离: `chat-spam-threshold-seconds`, `command-spam-threshold-seconds` (默认10秒)

---

## 所有指令 (含基本语法)

| 指令 | 语法概要 |
|------|----------|
| /advancement | `(grant\|revoke) ...` |
| /ban | `<目标> [原因]` |
| /ban-ip | `<地址\|目标> [原因]` |
| /banlist | `[ips]` |
| /bossbar | `(add\|get\|list\|remove\|set) ...` |
| /clear | `[目标] [物品] [数量]` |
| /clone | `<起点> <终点> <目标> ...` |
| /damage | `<目标> <伤害值> ...` |
| /datapack | `(enable\|disable\|list\|reload) ...` |
| /debug | `(start\|stop\|function)` |
| /defaultgamemode | `<模式>` |
| /deop | `<目标>` |
| /difficulty | `[peaceful\|easy\|normal\|hard]` |
| /effect | `(give\|clear) ...` |
| /enchant | `<目标> <魔咒> [等级]` |
| /execute | `... run <指令>` |
| /experience (/xp) | `(add\|set\|query) ...` |
| /fill | `<起点> <终点> <方块> ...` |
| /forceload | `(add\|remove\|query)` |
| /function | `<函数名> ...` |
| /gamemode | `<模式> [目标]` |
| /gamerule | `<规则名> [值]` |
| /give | `<目标> <物品> [数量]` |
| /help | `[页码\|指令名]` |
| /item | `...` |
| /jfr | `(start\|stop)` |
| /kick | `<目标> [原因]` |
| /kill | `[目标]` |
| /list | (无参数) |
| /locate | `(structure\|biome\|poi) ...` |
| /loot | `...` |
| /me | `<动作>` |
| /msg (/tell, /w) | `<目标> <消息>` |
| /op | `<目标>` |
| /pardon | `<目标>` |
| /pardon-ip | `<地址>` |
| /particle | `<粒子名> ...` |
| /perf | `(start\|stop\|query)` |
| /place | `(feature\|jigsaw\|template) ...` |
| /playsound | `<音效> ...` |
| /publish | (无参数) |
| /random | `(value\|roll) ...` |
| /reload | (无参数) |
| /return | `<值>` |
| /ride | `...` |
| /sapling | (设置/查询) |
| /say | `<消息>` |
| /schedule | `(function\|clear) ...` |
| /scoreboard | `...` |
| /seed | (无参数) |
| /setblock | `<位置> <方块> ...` |
| /setidletimeout | `<分钟>` |
| /setworldspawn | `[位置]` |
| /spawnpoint | `[目标] [位置]` |
| /spectate | `[目标]` |
| /spreadplayers | `...` |
| /stopsound | `[目标] ...` |
| /summon | `<实体ID> [位置] [NBT]` |
| /tag | `(add\|remove\|list) ...` |
| /team | `(add\|remove\|join\|leave\|list\|modify) ...` |
| /teammsg (/tm) | `<消息>` |
| /teleport (/tp) | `<目标> <位置>` |
| /tellraw | `<目标> <JSON>` |
| /time | `(set\|add\|query) ...` |
| /title | `...` |
| /toggledownfall | (无参数) |
| /trigger | `<目标> ...` |
| /unpublish | (无参数) |
| /weather | `(clear\|rain\|thunder) [持续时间]` |
| /worldborder | `(add\|get\|set\|center\|damage\|warning) ...` |

---

## 所有实体 (命名空间ID)

### 生物 (Living)
- `minecraft:sulfur_cube`
- `minecraft:ender_dragon`
- `minecraft:wither`
- `minecraft:blaze`
- `minecraft:bogged`
- `minecraft:breeze`
- `minecraft:cave_spider`
- `minecraft:creeper`
- `minecraft:drowned`
- `minecraft:elder_guardian`
- `minecraft:enderman`
- `minecraft:endermite`
- `minecraft:evoker`
- `minecraft:ghast`
- `minecraft:giant`
- `minecraft:guardian`
- `minecraft:piglin_brute`
- `minecraft:pillager`
- `minecraft:ravager`
- `minecraft:silverfish`
- `minecraft:skeleton`
- `minecraft:slime`
- `minecraft:stray`
- `minecraft:vex`
- `minecraft:warden`
- `minecraft:witch`
- `minecraft:wither_skeleton`
- `minecraft:zombie`
- `minecraft:zombified_piglin`
- `minecraft:piglin`
- `minecraft:spider`
- `minecraft:wolf`
- `minecraft:allay`
- `minecraft:armadillo`
- `minecraft:axolotl`
- `minecraft:bat`
- `minecraft:bee`
- `minecraft:camel`
- `minecraft:cat`
- `minecraft:chicken`
- `minecraft:cod`
- `minecraft:copper_golem`
- `minecraft:cow`
- `minecraft:dolphin`
- `minecraft:donkey`
- `minecraft:fox`
- `minecraft:frog`
- `minecraft:glow_squid`
- `minecraft:goat`
- `minecraft:hoglin`
- `minecraft:horse`
- `minecraft:husk`
- `minecraft:illusioner`
- `minecraft:iron_golem`
- `minecraft:llama`
- `minecraft:magma_cube`
- `minecraft:mooshroom`
- `minecraft:mule`
- `minecraft:ocelot`
- `minecraft:parrot`
- `minecraft:pig`
- `minecraft:polar_bear`
- `minecraft:pufferfish`
- `minecraft:rabbit`
- `minecraft:salmon`
- `minecraft:sheep`
- `minecraft:skeleton_horse`
- `minecraft:sniffer`
- `minecraft:snow_golem`
- `minecraft:squid`
- `minecraft:tropical_fish`
- `minecraft:turtle`
- `minecraft:villager`
- `minecraft:wandering_trader`
- `minecraft:zombie_horse`
- `minecraft:zombie_villager`

### 弹射物与投掷物
- `minecraft:arrow`
- `minecraft:dragon_fireball`
- `minecraft:experience_bottle`
- `minecraft:eye_of_ender`
- `minecraft:fireball`
- `minecraft:firework_rocket`
- `minecraft:fishing_bobber`
- `minecraft:lingering_potion`
- `minecraft:llama_spit`
- `minecraft:shulker_bullet`
- `minecraft:small_fireball`
- `minecraft:snowball`
- `minecraft:spectral_arrow`
- `minecraft:egg`
- `minecraft:ender_pearl`
- `minecraft:experience_orb`
- `minecraft:potion`
- `minecraft:trident`
- `minecraft:wind_charge`
- `minecraft:wither_skull`

### 载具
- 各种船: `oak_boat`, `spruce_boat`, `birch_boat`, `jungle_boat`, `acacia_boat`, `dark_oak_boat`, `mangrove_boat`, `cherry_boat`, `bamboo_raft`
- 各种运输船: 前缀 `chest_` 加以上名称
- 各种矿车: `minecart`, `chest_minecart`, `command_block_minecart`, `furnace_minecart`, `hopper_minecart`, `spawner_minecart`, `tnt_minecart`

### 技术性实体
- `minecraft:area_effect_cloud`
- `minecraft:armor_stand`
- `minecraft:item_frame`
- `minecraft:glow_item_frame`
- `minecraft:lightning_bolt`
- `minecraft:marker`
- `minecraft:item`
- `minecraft:falling_block`
- `minecraft:end_crystal`
- `minecraft:evoker_fangs`
- `minecraft:interaction`
- `minecraft:text_display`
- `minecraft:item_display`
- `minecraft:block_display`

---

## 所有游戏规则 (Gamerule)

| 规则名 | 类型 | 默认值 |
|--------|------|--------|
| keep_inventory | bool | false |
| pvp | bool | true |
| drowning_damage | bool | true |
| fall_damage | bool | true |
| fire_damage | bool | true |
| freeze_damage | bool | true |
| natural_health_regeneration | bool | true |
| immediate_respawn | bool | false |
| limited_crafting | bool | false |
| respawn_radius | int | 10 |
| players_sleeping_percentage | int | 100 |
| locator_bar | bool | true |
| spectators_generate_chunks | bool | true |
| ender_pearls_vanish_on_death | bool | true |
| elytra_movement_check | bool | true |
| player_movement_check | bool | true |
| players_nether_portal_default_delay | int | 80 |
| announce_advancements | bool | true |
| block_drops | bool | true |
| command_block_output | bool | true |
| disable_raids | bool | false |
| do_daylight_cycle | bool | true |
| do_entity_drops | bool | true |
| do_fire_tick | bool | true |
| do_insomnia | bool | true |
| do_mob_loot | bool | true |
| do_mob_spawning | bool | true |
| do_patrol_spawning | bool | true |
| do_trading | bool | true |
| do_warden_spawning | bool | true |
| do_weather_cycle | bool | true |
| max_entity_cramming | int | 24 |
| mob_griefing | bool | true |
| random_tick_speed | int | 3 |
| reduced_debug_info | bool | false |
| send_command_feedback | bool | true |
| show_death_messages | bool | true |
| spawn_chunk_radius | int | 2 |

---

## 目标选择器
- `@p` – 最近玩家
- `@r` – 随机玩家
- `@a` – 所有玩家
- `@e` – 所有实体
- `@s` – 执行者自身

## 物品组件 (用于指令)
- 使用 `[组件名=值]` 格式，如 `give @p diamond_sword[enchantments={"minecraft:sharpness":10}]`

## 实体NBT (用于/summon)
- 使用SNBT格式，如 `summon zombie ~ ~ ~ {IsBaby:true}`

---

以上为Minecraft Java版26.2所有主要指令、实体、游戏规则及新增内容完整集合。