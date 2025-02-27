/* License CC0 */
var table_js = function(customization) {
    function make_cell(contents_addr) {
        return { l: true, u: true, r: true, d: true, contents_addr: contents_addr };
    }
    function make_model(h, w) {
        var init = customization.init;
        var m = [];
        var contents = [];
        for (var y = 0; y < h; y++) {
            m[y] = [];
            for (var x = 0; x < w; x++) {
                m[y][x] = make_cell(contents.length);
                contents.push(init({y:y, x:x}));
            }
        }
        var focus = {y:0,x:0};
        return { m, contents, focus };
    }
    function height(mod) {
        return mod.m.length;
    }
    function width(mod) {
        return mod.m[0].length;
    }
    function copy(mod, transform) {
        var transform = transform || {
            h: (hw => hw.h),
            w: (hw => hw.w),
            x: (yxhw => yxhw.x),
            y: (yxhw => yxhw.y),
            l: (c => c.l),
            u: (c => c.u),
            r: (c => c.r),
            d: (c => c.d),
        };
        var h = height(mod)
        var w = width(mod)
        var c = make_model(transform.h({h,w}), transform.w({h,w}));
        var contents_redirect = {};
        c.contents = [];
        for (var y = 0; y < height(mod); y++) {
            for (var x = 0; x < width(mod); x++) {
                var cell = mod.m[y][x];

                // lazily copy the mod.contents to c.contents
                if (typeof(contents_redirect[cell.contents_addr]) == 'undefined') {
                    contents_redirect[cell.contents_addr] = c.contents.length;
                    var copied_contents = customization.deep_copy_content(mod.contents[cell.contents_addr]);
                    c.contents.push(copied_contents);
                }

                c.m[transform.y({y,x,h,w})][transform.x({y,x,h,w})] = {
                    l: transform.l(cell),
                    u: transform.u(cell),
                    r: transform.r(cell),
                    d: transform.d(cell),
                    contents_addr: contents_redirect[cell.contents_addr]
                };
            }
        }
        var focushw = {y: mod.focus.y, x: mod.focus.x, h, w};
        c.focus = fuse_corner(c, transform.y(focushw), transform.x(focushw));
        return c;
    }

    function update_focus(mod, y, x) {
        var mod = copy(mod, false);
        mod.focus = { y, x }
        return mod;
    }

    function delete_column(mod, col, skip_recursive_delete) {
        var mod = mod;
        if (width(mod) == 1) {
            return make_model(1, 1);
        } else {
            for (var y = 0; y < height(mod); y++) {
                if (width(mod) == 1) {
                    // can't happen, already tested above.
                } else if (col == 0) {
                    mod.m[y][col+1].l = true;
                } else if (col == width(mod) - 1) {
                    mod.m[y][col-1].r = true;
                } else {
                    if (mod.m[y][col-1].r || mod.m[y][col+1].l) {
                        mod.m[y][col-1].r = true;
                        mod.m[y][col+1].l = true;
                    }
                }
            }
            for (var y = 0; y < height(mod); y++) {
                mod.m[y].splice(col,1);
            }
            if (mod.focus.x >= col && mod.focus.x >= 1) {
                mod.focus.x = mod.focus.x - 1;
            }

            if (! skip_recursive_delete) {
                mod = delete_useless_rows(mod);
            }

            return mod;
        }
    }

    function delete_useless_rows(mod) {
        var mod = mod;
        for (var y = height(mod) - 1; y >= 1; y--) {
            var keep_line = false;
            for (var x = 0; x < width(mod); x++) {
                if (mod.m[y][x].u) {
                    keep_line = true;
                    break;
                }
            }
            if (! keep_line) {
                mod = delete_row(mod, y, true);
            }
        }
        return mod;
    }

    function delete_useless_rows_and_columns(mod) {
        return transpose(delete_useless_rows(transpose(delete_useless_rows(mod))));
    }

    function sanitize(mod) {
        var w = width(mod);
        var h = height(mod);
        for (var y = 0; y < h; y++) {
            mod.m[y][0].l = true;
            mod.m[y][w-1].r = true;
            for (var x = 0; x < w - 1; x++) { // skip rightmost cell
                var border = mod.m[y][x].r || mod.m[y][x+1].l;
                mod.m[y][x].r = border;
                mod.m[y][x+1].l = border;
            }
        }
        for (var x = 0; x < w; x++) {
            mod.m[0][x].u = true;
            mod.m[h-1][x].d = true;
            for (var y = 0; y < h - 1; y++) { // skip bottommost cell
                var border = mod.m[y][x].d || mod.m[y+1][x].u;
                mod.m[y][x].d = border;
                mod.m[y+1][x].u = border;
            }
        }
        mod.focus = fuse_corner(mod, mod.focus.y, mod.focus.x);
    }

    function serialize(mod) {
        return JSON.stringify({m: mod.m, contents: mod.contents, focus: mod.focus});
    }

    function deserialize(json) {
        var mc = JSON.parse(json);
        return sanitize({ m: mc.m, contents: mc.contents, focus: mc.focus });
    }

    function transpose(mod) {
        return copy(mod, {
            h: (hw => hw.w),
            w: (hw => hw.h),
            x: (yxhw => yxhw.y),
            y: (yxhw => yxhw.x),
            l: (c => c.u),
            u: (c => c.l),
            r: (c => c.d),
            d: (c => c.r),
        });
    }

    function mirror_vertically(mod) {
        return copy(mod, {
            h: (hw => hw.h),
            w: (hw => hw.w),
            x: (yxhw => yxhw.x),
            y: (yxhw => yxhw.h - yxhw.y - 1),
            l: (c => c.l),
            u: (c => c.d),
            r: (c => c.r),
            d: (c => c.u),
        });
    }

    function mirror_horizontally(mod) {
        return copy(mod, {
            h: (hw => hw.h),
            w: (hw => hw.w),
            x: (yxhw => yxhw.w - yxhw.x - 1),
            y: (yxhw => yxhw.y),
            l: (c => c.r),
            u: (c => c.u),
            r: (c => c.l),
            d: (c => c.d),
        });
    }

    function delete_row(mod, row, skip_recursive_delete) {
        return transpose(delete_column(transpose(mod), row, skip_recursive_delete));
    }

    function insert_column(mod, col, init) {
        for (var y = 0; y < height(mod); y++) {
            mod.m[y].splice(col,0,make_cell(mod.contents.length));
            mod.contents.push(init({y,x:col}));
            
            if (col == 0) {
                // nothing to do.
            } else if (col == width(mod)) {
                // nothing to do.
            } else {
                if (mod.m[y][col-1].r || mod.m[y][col+1].l) {
                    // nothing to do.
                } else {
                    // inserted in the middle of a fusion
                    // no horizontal edges
                    mod.m[y][col].r = false;
                    mod.m[y][col].l = false;
                    // same vertical edges as neighbours
                    console.assert(mod.m[y][col-1].u == mod.m[y][col+1].u)
                    console.assert(mod.m[y][col-1].d == mod.m[y][col+1].d)
                    mod.m[y][col].u = mod.m[y][col-1].u;
                    mod.m[y][col].d = mod.m[y][col-1].d;
                }
            }
        }
        if (mod.focus.x >= col) {
            mod.focus.x++;
        }
        return mod;
    }

    function insert_row(mod, row, init) {
        return transpose(insert_column(transpose(mod), row, yx => init({y:yx.x, x:yx.y})));
    }

    function fuse_corner(mod, y, x) {
        while (!mod.m[y][x].l) { x--; }
        while (!mod.m[y][x].u) { y--; }
        return {y,x};
    }

    function fuse_width(mod, y, x) {
        var rightmost;
        for (rightmost = x; !mod.m[y][rightmost].r; rightmost++) { }
        return rightmost - x + 1;
    }

    function fuse_height(mod, y, x) {
        var bottommost;
        for (bottommost = y; !mod.m[bottommost][x].d; bottommost++) { }
        return bottommost - y + 1;
    }

    function check_fuse_right(mod, y, x) {
        if ((!mod.m[y][x].l) || (!mod.m[y][x].u)) {
            //console.log ("["+y+"]["+x+"] is not the top-left corner of a fuse");
            return false;
        }

        var rightmost = x + fuse_width(mod, y, x) - 1;
        var bottommost = y + fuse_height(mod, y, x) - 1;

        if (rightmost >= width(mod) - 1) {
            //console.log ("the fuse starting at [y][x] is touching the right edge, can't fuse to the right.");
            return false;
        }

        var first_x_rhs = rightmost + 1;
        var first_rhs_width = fuse_width(mod, y, first_x_rhs);
        var rightmost_rhs = first_x_rhs + first_rhs_width - 1;

        if (!mod.m[y][first_x_rhs].u) {
            //console.log ("[y][first_x_rhs] is not the top-left corner of a fuse");
            return false;
        }

        var y_rhs;
        var x_rhs;
        for (y_rhs = y; y_rhs <= bottommost; y_rhs += fuse_height(mod, y_rhs, first_x_rhs)) {
            if (fuse_width(mod, y_rhs, first_x_rhs) != first_rhs_width) {
                //console.log("the fuse starting at [y_rhs][first_x_rhs] is not "
                //    + "the same width as the fuse starting at [y][first_x_rhs],"
                //    + "can't collapse these into a single column.")
                return false;
            }
        }
        if (y_rhs != bottommost + 1) {
            //console.log("the last fuse in the rhs is too high, it ends below"
            //    + "the bottommost element of the fuse starting at [y][x].");
            return false;
        }

        return {  };
    }

    function fuse_right_(mod, dir, y, x) {
        if (! check_fuse_right(mod, y, x)) {
            return mod;
        };

        var rightmost = x + fuse_width(mod, y, x) - 1;
        var bottommost = y + fuse_height(mod, y, x) - 1;
        var first_x_rhs = x + fuse_width(mod, y, x);
        var first_rhs_width = fuse_width(mod, y, first_x_rhs);
        var rightmost_rhs = first_x_rhs + first_rhs_width - 1;

        var new_contents_addr = mod.m[y][x].contents_addr;    
        var discarded_cell_contents = [];

        // loop over the fuses in the right-hand-side
        for (var y_rhs = y; y_rhs <= bottommost; y_rhs += fuse_height(mod, y_rhs, first_x_rhs)) {
            var cell = mod.m[y_rhs][first_x_rhs];
            discarded_cell_contents.push(mod.contents[cell.contents_addr]); // copy old contents
            mod.contents[cell.contents_addr] = null; // erase old contents
        }

        // loop over the cells in the right-hand-site and add them to the main fuse
        for (var y_rhs = y; y_rhs <= bottommost; y_rhs++) {
            // we also update the rihghtmost column of the main fuse.
            for (x_rhs = rightmost; x_rhs <= rightmost_rhs; x_rhs++) {
                var cell = mod.m[y_rhs][x_rhs];

                // set contents_addr
                cell.contents_addr = new_contents_addr; // point to new contents

                // set borders
                cell.l = (x_rhs == x);
                cell.u = (y_rhs == y);
                cell.r = (x_rhs == rightmost_rhs);
                cell.d = (y_rhs == bottommost);
            }
        }

        mod.contents[new_contents_addr] = customization.merge_contents(dir, mod.contents[new_contents_addr], discarded_cell_contents);

        mod.focus = fuse_corner(mod, mod.focus.y, mod.focus.x);

        mod = delete_useless_rows_and_columns(mod);

        return mod;
    }

    function fuse_right(mod, x, y) {
        return fuse_right_(mod, "r", x, y);
    }

    function fuse_down(mod, y, x) {
        return transpose(fuse_right_(transpose(mod), "d", x, y));
    }

    function check_fuse_down(mod, y, x) {
        return check_fuse_right(transpose(mod), x, y);
    }

    function check_fuse_left(mod, y, x) {
        return check_fuse_right(mirror_horizontally(mod), y, width(mod) - x - fuse_width(mod, y, x));
    }

    function check_fuse_up(mod, y, x) {
        return check_fuse_left(transpose(mod), x, y);
    }

    function check_fuse(mod, y, x) {
        return {
            l: check_fuse_left(mod, y, x),
            u: check_fuse_up(mod, y, x),
            r:check_fuse_right(mod, y, x),
            d:check_fuse_down(mod, y, x)
        };
    }

    function fuse_left_(mod, dir, y, x) {
        return mirror_horizontally(fuse_right_(mirror_horizontally(mod), dir, y, width(mod) - x - fuse_width(mod, y, x)));
    }

    function fuse_left(mod, y, x) {
        return fuse_left_(mod, "l", y, x);
    }

    function fuse_up(mod, y, x) {
        return transpose(fuse_left_(transpose(mod), "u", x, y));
    }

    function to_html(state) {
        var content_to_html = customization.content_to_html;
        var id_prefix = customization.id_prefix;
        var mod = get_current_mod(state);

        var c = function(tag) { return document.createElement(tag); };
        var appendChild = function(elem, tag, className) {
            var child = c(tag);
            elem.appendChild(child);
            child.className = className;
            return child;
        }

        var make_button = function (class_, callback, label, tooltip) {
            var a = c('a');
            a.className = class_;
            a.setAttribute('title', tooltip);
            a.addEventListener('click', function (e) { callback(e); e.preventDefault(); return void(0); });
            a.innerHTML = label;
            return a;
        }
        var insert_column_button = function(index) {
            return make_button('column-button insert-button', function(e) { update_state(state, insert_column, [index, customization.init_new_column]) }, '+', 'Insert column');
        }
        var insert_row_button = function (index) {
            return make_button('row-button insert-button', function(e) { update_state(state, insert_row, [index, customization.init_new_row]) }, '+', 'Insert row');
        }
        var delete_column_button = function (index) {
            return make_button('column-button delete-button', function(e) { update_state(state, delete_column, [index, false]) }, 'ⓧ', 'Delete column');
        }
        var delete_row_button = function (index) {
            return make_button('row-button delete-button', function(e) { update_state(state, delete_row, [index, false]) }, 'ⓧ', 'Delete row');
        }
        var fuse_button = function(label, direction, fuse_f) {
            return make_button('', function (e) {
                update_state(state, function (mod) { return fuse_f(mod, mod.focus.y, mod.focus.x); }, []);
            }, label, 'Fuse with the cells ' + direction);
        };

        var div = c('div');

        var make_all_fuse_buttons = function() {
            var div_fuse = c('div');
            div_fuse.setAttribute('id', 'all-fuse-buttons');
            var make_fuse_button = function(dir, label, direction, fuse_f) {
                var d = appendChild(div_fuse, 'div', 'fuse-button');
                d.setAttribute('id', ''+id_prefix+'-fuse-' + dir);
                d.appendChild(fuse_button(label, direction, fuse_f));
            }
            make_fuse_button('l', '←', 'to the left',  fuse_left);
            make_fuse_button('u', '↑', 'above',        fuse_up);
            make_fuse_button('r', '→', 'to the right', fuse_right);
            make_fuse_button('d', '↓', 'below',        fuse_down);
            return div_fuse;
        }

        div.appendChild(make_all_fuse_buttons());

        var table = appendChild(div, 'table', '');

        // colgroup    
        var colgroup = appendChild(table, 'colgroup', '');
        appendChild(colgroup, 'col', 'insert-delete-row-col');
        for (var x = 0; x < width(mod); x++) {
            appendChild(colgroup, 'col', 'user-column-col');
        }

        // thead
        var thead = appendChild(table, 'thead', '');
        var first_tr = appendChild(thead, 'tr', '');
        var first_first_th = appendChild(first_tr, 'th', 'insert-delete-column insert-delete-row');
        first_first_th.appendChild(insert_column_button(0));
        first_first_th.appendChild(insert_row_button(0));
        for (var x = 0; x < width(mod); x++) {
            var th = appendChild(first_tr, 'th', 'insert-delete-column');
            th.appendChild(delete_column_button(x));
            th.appendChild(insert_column_button(x+1))
        }

        // tbody
        var tbody = appendChild(table, 'tbody', '');
        for (var y = 0; y < height(mod); y++) {
            var tr = appendChild(tbody, 'tr', '');
            first_th = appendChild(tr, 'th', 'insert-delete-row');
            first_th.appendChild(delete_row_button(y));
            first_th.appendChild(insert_row_button(y+1));
            for (var x = 0; x < width(mod); x++) {
                var cell = mod.m[y][x];
                if (cell.l && cell.u) {
                    var td = appendChild(tr, 'td', '');
                    td.setAttribute('id', '' + id_prefix + '-' + y + '-' + x);
                    td.setAttribute('rowspan', fuse_height(mod, y, x));
                    td.setAttribute('colspan', fuse_width(mod, y, x));
                    td.appendChild(content_to_html(mod.contents[cell.contents_addr], {y,x}));

                    var f = function (closure_y, closure_x) {
                        return function (e) {
                            var old = document.getElementById('all-fuse-buttons');
                            old.parentElement.removeChild(old);
                            var td = document.getElementById(id_prefix + '-' + closure_y + '-' + closure_x);
                            td.appendChild(make_all_fuse_buttons());
                            update_state(state, update_focus, [closure_y, closure_x], true, true);
                            return true;
                        }
                    }
                    // focus
                    td.addEventListener('focusin', f(y, x));
                }
            }
        }

        return div;
    }

    function getOffset(elt) {
        if (elt) {
            var o = getOffset(elt.offsetParent);
            return { left: elt.offsetLeft + o.left, top: elt.offsetTop + o.top };
        } else {
            return { left: 0, top: 0 };
        }
    }

    function reload_values(mod) {
        var id_prefix = customization.id_prefix;
        var html_to_content = customization.html_to_content;
        var already_reloaded = {};
        for (var y = 0; y < height(mod); y++) {
            for (var x = 0; x < width(mod); x++) {
                if (mod.m[y][x].l && mod.m[y][x].u) {
                    var addr = mod.m[y][x].contents_addr;
                    if (! already_reloaded[addr]) {
                        already_reloaded[addr] = true;
                        mod.contents[addr] = html_to_content(document.getElementById(id_prefix + '-' + y + '-' + x));
                    }
                }
            }
        }
        return mod;
    }

    function get_current_mod(state) {
        return state.stack[state.current];
    }

    function set_current_mod(state, mod) {
        state.stack.splice(state.current + 1, state.stack.length - state.current - 1);
        state.current++;
        return state.stack[state.current] = mod;
    }

    function undo(state) {
        state.current--;
    }

    function redo(state) {
        state.current++;
        if (state.current >= state.stack.length) {
            state.current = state.stack.length - 1;
        }
    }

    function create_state_from_mod(initial_mod) {
        return { current: 0, stack: [initial_mod] };
    }

    function create_state(height, width) {
        return create_state_from_mod(make_model(height, width));
    }

    function update_state(state, f, args, skip_redraw, skip_history, skip_reload) {
        var id_prefix = customization.id_prefix;

        var mod = copy(get_current_mod(state), false);
        var matrix_reloaded = skip_reload ? mod : reload_values(mod);
        args.splice(0, 0, matrix_reloaded);
        var new_mod = f.apply(null, args);
        set_current_mod(state, new_mod);
        
        if (!skip_redraw) {
            document.getElementById(id_prefix).innerHTML = '';
            document.getElementById(id_prefix).appendChild(to_html(state));
            document.getElementById(id_prefix + '-' + new_mod.focus.y + '-' + new_mod.focus.x).getElementsByTagName('textarea')[0].focus();
            for (var y = 0; y < height(new_mod); y++) {
                for (var x = 0; x < width(new_mod); x++) {
                    var el = document.getElementById(id_prefix + '-' + y + '-' + x);
                    if (el) {
                        customization.postprocess(el);
                    }
                }
            }
        }
        // draw merge arrows:
        var td = document.getElementById(id_prefix + '-' + new_mod.focus.y + '-' + new_mod.focus.x);
        var tdw = td.offsetWidth;
        var tdh = td.offsetHeight;
        var check = check_fuse(new_mod, new_mod.focus.y, new_mod.focus.x);
        var o = getOffset(td);
        var pos = function(dir, left, top) {
            var elt = document.getElementById(id_prefix + '-fuse-'+dir);
            elt.style.display = check[dir] ? 'inherit' : 'none';
            var elto = getOffset(elt.offsetParent);
            elt.style.left = left - elto.left - elt.offsetWidth/2;
            elt.style.top = top - elto.top - elt.offsetHeight/2;
        }
        pos('l', o.left, o.top + td.offsetHeight/2);
        pos('u', o.left + td.offsetWidth/2, o.top);
        pos('r', o.left + td.offsetWidth, o.top + td.offsetHeight/2);
        pos('d', o.left + td.offsetWidth/2, o.top + td.offsetHeight);
        return true;
    }

    function cell_contents(mod, yx, updater) {
        var addr = mod.m[yx.y][yx.x].contents_addr;
        if (updater) {
            mod.contents[addr] = updater(mod.contents[addr]);
            return mod;
        } else {
            return mod.contents[addr];
        }
    }

    function focus(mod, yx) {
        if (yx) {
            mod.focus.y = yx.y;
            mod.focus.y = yx.x;
            return mod;
        } else {
            return mod.focus;
        }
    }

    return {
        // protected
        make_model,
        delete_column,
        delete_row,
        insert_column,
        insert_row,
        fuse_left,
        fuse_up,
        fuse_right,
        fuse_down,
        create_state_from_mod,
        // public
        create_state,
        serialize,
        deserialize,
        update_state,
        undo,
        redo,
        cell_contents,
        focus,
    }
}
