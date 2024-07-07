"use strict";
const ROW_MAX_CHAR = 15;
const RECORD_WINDOW_SIZE = 15;
const DEFAULT_ENFORCE_SIZE = 10;
class Random {
    static getRandomValues(count) {
        let array = new Uint32Array(count);
        window.crypto.getRandomValues(array);
        return array;
    }
    static range(lb, ub) {
        let arr = Random.getRandomValues(1);
        return (ub - lb) * arr[0] / this.RANDOM_UPPER + lb;
    }
}
Random.RANDOM_UPPER = 0x100000000;
/**
 * 用于记录每一字根的学习情况
 */
class RecordItem {
    constructor(problem_id) {
        // 最近 RECORD_WINDOW_SIZE 次正确回答时间的总和
        this.sumtime = 0;
        // 所有正确回答的次数
        this.count = 0;
        // 问题编号
        this.problem_id = problem_id;
        // 最近 RECORD_WINDOW_SIZE 次正确回答的时间
        this.window = new Array(RECORD_WINDOW_SIZE);
        // 当前窗口下标
        this.index = 0;
        //用于随机产生字根，表示前面的字根，最近 RECORD_WINDOW_SIZE 次正确回答的平均时间的和
        this.presum_time = 0;
    }
    /**
     * 正确回答后更新窗口
     * @param {number} time
     */
    update(time) {
        let pres = this.sumtime, cnt = this.count;
        if (cnt == 0) {
            cnt = 1;
        }
        if (this.count < RECORD_WINDOW_SIZE) {
            this.sumtime += time;
            this.window[this.index] = time;
            this.index = (this.index + 1) % RECORD_WINDOW_SIZE;
        }
        else {
            this.sumtime += time - this.window[this.index];
            this.window[this.index] = time;
            this.index = (this.index + 1) % RECORD_WINDOW_SIZE;
        }
        this.count++;
        // return this.sumtime / this.count - pres / cnt;
    }
}
class RecordSet {
    constructor() {
        this.init(0);
    }
    init(cnt) {
        this.records = new Array(cnt);
        for (let i = 0; i < cnt; i++) {
            this.records[i] = new RecordItem(i);
        }
        this.record_ne0_cnt = 0;
        this.record_sum_time = 0;
        this.begin_time = new Date().valueOf();
        this.last_correct_time = this.begin_time;
        this.pressed_cnt = 0;
        this.correct_cnt = 0;
    }
    /**
     * 更新某一字根的正确时长
     * @param {number} time 当前字根正确花费时长
     */
    update(id, time) {
        let record = this.records[id]; //<reference
        if (record.sumtime == 0) {
            this.record_ne0_cnt++;
        }
        record.update(time);
    }
    sort_records() {
        let presum_time = 0;
        for (let i = 0, n = this.records.length; i < n; i++) {
            let c = this.records[i].count;
            c = c ? c : 1;
            presum_time += this.records[i].sumtime / c;
            this.records[i].presum_time = presum_time;
        }
        this.record_sum_time = presum_time;
    }
    records_lower_bound(offset) {
        let l = 0, r = this.records.length;
        while (l < r) {
            let m = l + r >> 1;
            if (this.records[m].presum_time < offset) {
                l = m + 1;
            }
            else {
                r = m;
            }
        }
        if (r >= this.records.length) {
            r = this.records.length - 1;
            console.warn("r>=this.records.length", r, this.records.length);
        }
        return r;
    }
    random_ids(count) {
        this.sort_records();
        count = Math.min(count, this.record_ne0_cnt);
        let ids = new Array(count);
        let enforcing = new Array(count);
        for (let i = 0; i < count; i++) {
            let offset = Random.range(0, this.record_sum_time);
            ids[i] = this.records_lower_bound(offset);
            enforcing[i] = true;
        }
        return new ProblemRow(ids, enforcing);
    }
}
class ProblemSet {
    constructor(problem, answer, hint) {
        this.problem = problem ? problem : [];
        this.answer = answer ? answer : [];
        this.hint = hint ? hint : [];
        this.max_enforce_window = DEFAULT_ENFORCE_SIZE;
    }
    get_problem(id) {
        return this.problem[id];
    }
    get_answer(id) {
        return this.answer[id];
    }
    get_hint(id) {
        return this.hint[id] ? (":" + this.hint[id]) : "";
    }
    get_length() {
        return this.problem.length;
    }
}
class ProblemRow {
    constructor(ids, enforcing) {
        this.problem_ids = ids;
        this.problem_is_enforcing = enforcing;
        this.now_position = 0;
    }
    concat(row) {
        this.problem_ids.concat(row.problem_ids);
        this.problem_is_enforcing.concat(row.problem_is_enforcing);
    }
}
class TyperView {
    constructor(typer) {
        this.typer = typer;
        this.course_selector = document.getElementById("course_selector");
        this.main = document.getElementById("main");
        this.inbox_display = document.getElementsByClassName("inbox display")[0];
        this.inbox_input = document.getElementsByClassName("inbox input")[0];
        this.inputtip = document.getElementsByClassName("inputtip")[0];
        this.wrongtip = document.getElementsByClassName("wrongtip")[0];
        this.stat_info = document.getElementsByClassName("stat")[0];
        this.course_name_display = document.getElementsByClassName("course_name")[0];
        this.checkbox_study = document.getElementById("study");
        this.checkbox_fast = document.getElementById("fast");
        this.checkbox_hint = document.getElementById("hint");
        for (let i = 0; i < typer.config.row_max_char; i++) {
            let el = document.createElement("div");
            this.inbox_display.append(el);
        }
        this.button_start = document.getElementById("pstart");
        this.button_start.addEventListener("click", () => { this.typer.controller.start(); });
        this.button_switch = document.getElementById("pswitch");
        this.button_switch.addEventListener("click", () => { this.typer.controller.change(); });
        this.kbd = document.getElementById("kbd");
        this.kbd.addEventListener("input", (e) => { this.typer.controller.ontype(e); });
        this.inbox_input.addEventListener("focus", () => { this.focus_kbd(); });
        this.kbd.addEventListener("focus", () => {
            this.inbox_input.classList.add("active");
        });
        this.kbd.addEventListener("blur", () => {
            this.inbox_input.classList.remove("active");
        });
        this.tree_select = document.getElementById("tree-select");
    }
    focus_kbd() {
        const len = this.typer.model.problem_row.problem_ids.length;
        if (len > 0) {
            this.kbd.focus();
        }
    }
    clear_inputed() {
        for (let i = 0; i < this.typer.config.row_max_char; i++) {
            if (this.inbox_input.children[0].classList.contains("bigchar")) {
                this.inbox_input.children[0].remove();
            }
            else {
                break;
            }
        }
    }
    clear_kbd() {
        this.kbd.value = "";
    }
    reset_row() {
        const len = this.typer.model.problem_row.problem_ids.length;
        this.clear_inputed();
        this.wrongtip.replaceChildren();
        if (len == 0) {
            return;
        }
        for (let i = 0; i < this.typer.config.row_max_char; i++) {
            let el = this.inbox_display.children[i];
            el.setAttribute("class", "bigchar");
            if (this.typer.model.problem_row.problem_is_enforcing[i]) {
                el.classList.add("enforcing");
            }
            el.innerText = this.typer.model.problem_set.get_problem(this.typer.model.problem_row.problem_ids[i]);
        }
        this.inbox_display.children[0].classList.add("active");
    }
    move_next() {
        let el = document.createElement("div");
        el.classList.add("bigchar");
        el.classList.add("inactive");
        el.innerText = this.typer.model.problem_set.get_problem(this.typer.model.problem_row.problem_ids[this.typer.model.problem_row.now_position]);
        this.inputtip.before(el);
        this.wrongtip.replaceChildren();
        this.inbox_display.children[this.typer.model.problem_row.now_position].classList.remove("active");
        this.inbox_display.children[this.typer.model.problem_row.now_position].classList.add("inactive");
        this.typer.model.problem_row.now_position++;
        if (this.typer.model.problem_row.now_position < this.typer.config.row_max_char) {
            this.inbox_display.children[this.typer.model.problem_row.now_position].classList.add("active");
            return true;
        }
        return false;
    }
    incorrect() {
        this.inbox_display.children[this.typer.model.problem_row.now_position].classList.remove("active");
        this.inbox_display.children[this.typer.model.problem_row.now_position].classList.add("wrong");
        let problem_id = this.typer.model.problem_row.problem_ids[this.typer.model.problem_row.now_position];
        let el = document.createElement("div");
        el.classList.add("bigchar");
        el.classList.add("wrongtip");
        let text = this.typer.model.problem_set.get_answer(problem_id).toUpperCase();
        if (this.checkbox_hint.checked) {
            text += this.typer.model.problem_set.get_hint(problem_id);
        }
        el.innerText = text;
        this.wrongtip.replaceChildren();
        this.wrongtip.append(el);
    }
    clear_wrong_tip() {
        this.wrongtip.replaceChildren();
    }
    show_main() {
        this.course_selector.hidden = true;
        this.main.hidden = false;
        this.typer.model.is_study = this.checkbox_study.checked;
        this.typer.model.is_fast = this.checkbox_fast.checked;
        this.course_name_display.innerText = this.get_selected_courses().join("、");
    }
    show_course_selector() {
        this.main.hidden = true;
        this.course_selector.hidden = false;
    }
    get_selected_courses() {
        let options = this.tree_select.selectedOptions;
        let ret = new Array(options.length);
        for (let i = 0; i < options.length; i++) {
            ret[i] = options[i].value;
        }
        return ret;
    }
    update_input_tip(str) {
        this.inputtip.innerText = str;
    }
}
class TyperController {
    constructor(typer) {
        this.typer = typer;
        this.generator = typer.config.generator;
        this.loader = typer.config.loader;
        this.typed = "";
    }
    start() {
        this.typer.view.show_main();
        this.loader.load();
        this.generator.generate();
        this.typer.view.reset_row();
        this.typer.view.focus_kbd();
    }
    change() {
        this.typer.view.show_course_selector();
    }
    correct() {
        if (!this.typer.view.move_next()) {
            this.generator.generate();
            this.typer.view.reset_row();
        }
    }
    incorrect() {
        this.typer.view.incorrect();
    }
    calc_speed() {
        let dt = new Date().valueOf() - this.typer.model.record.begin_time;
        let minutes = Math.floor(dt / 60000);
        let speed = Math.floor(this.typer.model.record.correct_cnt / Math.max(1, dt / 60000));
        let rate = Math.floor(this.typer.model.record.correct_cnt / this.typer.model.record.pressed_cnt * 100);
        let text = "时间:" + minutes + "分钟  速度:" + speed + "键/分钟  正确率:" + rate + "%";
        this.typer.view.stat_info.innerText = text;
    }
    ontype(e) {
        const problem_row = this.typer.model.problem_row;
        const problem_set = this.typer.model.problem_set;
        const record = this.typer.model.record;
        let char = e.data.toLowerCase();
        if (char != ' ') {
            this.typed += char;
            this.typer.view.clear_wrong_tip();
        }
        let id = problem_row.problem_ids[problem_row.now_position];
        let answer = problem_set.answer[id];
        if (char != ' ' && (this.typer.model.is_fast == false || this.typed.length < answer.length)) {
            this.typer.view.update_input_tip(this.typed.toUpperCase());
            return;
        }
        record.pressed_cnt++;
        if (this.typed == answer) {
            this.correct();
            record.correct_cnt++;
            let now_time = new Date().valueOf();
            if (problem_row.now_position == 0 || problem_row.problem_ids[problem_row.now_position] != problem_row.problem_ids[problem_row.now_position] - 1) {
                record.update(id, now_time - record.last_correct_time);
            }
            record.last_correct_time = now_time;
        }
        else {
            this.incorrect();
            record.last_correct_time -= 5000;
        }
        this.typed = "";
        this.typer.view.update_input_tip("");
        this.typer.view.clear_kbd();
        this.calc_speed();
    }
}
class TyperModel {
    constructor() {
        this.problem_set = new ProblemSet();
        this.problem_row = new ProblemRow([], []);
        this.record = new RecordSet();
        this.is_study = this.is_fast = false;
    }
}
/**
 * 用于显示打字界面
 */
class Typer {
    constructor(config) {
        // 打字机界面所在元素
        // this.element_root = element_root;
        this.config = config;
        this.controller = new TyperController(this);
        this.model = new TyperModel();
        this.view = new TyperView(this);
        this.config.loader.init(this.view, this.model);
        this.config.generator.init(this.model, this.config);
    }
}
class default_problem_generator {
    init(model, config) {
        this.model = model;
        this.config = config;
    }
    generate() {
        const problem_set_len = this.model.problem_set.get_length();
        if (problem_set_len == 0) {
            return;
        }
        this.model.record.sort_records();
        let ids = new Array(this.config.row_max_char), enforcing = new Array(this.config.row_max_char);
        let i = 0;
        if (this.model.is_study) {
            let tmp_row = this.model.record.random_ids(Math.round(this.config.enforce_size * Math.random()));
            for (; i < tmp_row.problem_ids.length; i++) {
                ids[i] = tmp_row.problem_ids[i];
                enforcing[i] = true;
            }
        }
        for (; i < this.config.row_max_char; i++) {
            let j = Random.range(0, problem_set_len);
            ids[i] = Math.floor(j);
            enforcing[i] = false;
        }
        for (i = 1; i < this.config.row_max_char; i++) {
            let j = Math.floor(Random.range(0, i + 1));
            let t = ids[i];
            ids[i] = ids[j];
            ids[j] = t;
            t = enforcing[i];
            enforcing[i] = enforcing[j];
            enforcing[j] = t;
        }
        this.model.problem_row = new ProblemRow(ids, enforcing);
    }
}
let g_typer;
document.addEventListener("DOMContentLoaded", () => {
    g_typer = new Typer({
        loader: new default_problem_loader(),
        generator: new default_problem_generator(),
        row_max_char: ROW_MAX_CHAR,
        record_window_size: RECORD_WINDOW_SIZE,
        enforce_size: DEFAULT_ENFORCE_SIZE,
    });
});
class default_problem_loader {
    init(view, model) {
        this.view = view;
        this.model = model;
    }
    static get_encoding(from, to) {
        let res = Array(to - from + 1);
        for (let i = from; i <= to; i++) {
            res[i - from] = String.fromCharCode(i);
        }
        return res;
    }
    load() {
        const data = {
            "笔画": [
                "a", default_problem_loader.get_encoding(0xe001, 0xe002), ,
                "i", default_problem_loader.get_encoding(0xe003, 0xe004), ,
                "m", default_problem_loader.get_encoding(0xe005, 0xe006), ,
                "s", default_problem_loader.get_encoding(0xe007, 0xe008), ,
                "x", default_problem_loader.get_encoding(0xe009, 0xe00b), ,
                "y", default_problem_loader.get_encoding(0xe00c, 0xe011), ,
                "z", default_problem_loader.get_encoding(0xe012, 0xe019), ,
            ],
            "主根1.1": [
                "a", "一", ,
                "b", "土士", "[本]土",
                "c", "王", "王[朝]",
                "d", "扌\ue01a", "[地]上有个扣子",
                "e", "艹廾\ue01b", "草药可以[医]病",
                "f", "木", "木[筏]",
                "g", "石丆", "石[膏]",
                "h", "匚臣\ue01c\ue01d\ue01e", "工匠[喝]水",
                "cs", "玉", ,
            ],
            "主根1.2": [
                "i", "虫", "我(I)不喜欢虫子",
                "j", "口\ue01f", "口[诀]",
                "k", "日曰\ue020\ue021\ue022", "[看]日出",
                "l", "目", "目[录]",
            ],
            "主根1.3": [
                "m", "\ue023\ue024", "青梅竹[马]",
                "n", "亻", "仙[女]",
                "o", "八", "8与0形似",
                "p", "金钅", "金[牌]",
                "q", "月\ue025\ue026", "月[球]",
                "r", "鱼魚\ue027\ue028", "美[人]鱼",
            ],
            "主根1.4": [
                "s", "言\ue029\ue02a", "[誓]言",
                "t", "疒病", "[通]病",
                "u", "忄\ue02b", "怕你(U)了",
                "v", "氵\ue02c\ue02d", "胜利(V)渡江",
                "w", "之辶\ue02e", "逃[亡]",
            ],
            "主根1.5": [
                "x", "马\ue02f\ue030\ue031", "马[戏]",
                "y", "阝卩\ue032廴了", "陆[游]",
                "z", "纟糸", "丝[竹]",
            ],
            "主根2.1": [
                "bd", "二", ,
                "cd", "三", ,
                "ed", "十", ,
                "fd", "酉", ,
                "gd", "大\ue033", ,
                "hd", "七\ue034\ue035\ue036\ue037", ,
            ],
            "主根2.2": [
                "id", "卜\ue038\ue039", ,
                "jd", "\ue040因", ,
                "kd", "刂\ue042\ue043\ue044", ,
                "ld", "冂同\ue045冋冏\ue046\ue047\ue048\ue049\ue04a岡罔冈网", ,
            ],
            "主根2.3": [
                "nd", "川\ue04b\ue04c\ue04d", ,
                "od", "\ue04f人", ,
                "oda", "入", ,
                "pd", "\ue050斤\ue051", ,
                "pda", "丘", ,
                "qd", "几", ,
                "qda", "凡", ,
                "rd", "儿", ,
            ],
            "主根2.4": [
                "td", "\ue052\ue053\ue054", ,
                "ud", "\ue055\ue056", ,
                "vd", "\ue057", ,
                "wd", "宀定", ,
            ],
            "主根2.5": [
                "yd", "刀", ,
                "yda", "乙⺄", ,
                "zd", "巛巜\ue058", ,
            ]
        };
        let options = this.view.get_selected_courses();
        let problem = [], answer = [], hint = [];
        for (let k = 0; k < options.length; k++) {
            let table = data[options[k]];
            for (let i = 0; i < table.length; i += 3) {
                let z = table[i + 1];
                if (typeof z === "string") {
                    z = z.split('');
                }
                for (let j = 0; j < table[i + 1].length; j++) {
                    answer.push(table[i]);
                    problem.push(table[i + 1][j]);
                    hint.push(table[i + 2]);
                }
            }
        }
        this.model.problem_set = new ProblemSet(problem, answer, hint);
        this.model.record.init(problem.length);
    }
}
