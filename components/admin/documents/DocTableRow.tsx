import { Component, createSignal, Show } from 'solid-js';
import { FileText, MoreHorizontal, Trash2, Eye, Edit, Megaphone } from 'lucide-solid';
import { AdminDocument } from '../../../services/firebaseService';

interface DocTableRowProps {
    doc: AdminDocument;
    onClick: (doc: AdminDocument) => void;
    onDelete?: (doc: AdminDocument) => void;
    onEdit?: (doc: AdminDocument) => void;
    onToggleAnnouncement?: (doc: AdminDocument) => void;
}

export const DocTableRow: Component<DocTableRowProps> = (props) => {
    const [menuOpen, setMenuOpen] = createSignal(false);

    return (
        <tr
            onClick={() => props.onClick(props.doc)}
            class="hover:bg-white/[0.02] transition-all cursor-pointer group"
        >
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${props.doc.isAnnouncement
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-white/5 border-white/10 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20'
                        }`}>
                        {props.doc.isAnnouncement
                            ? <Megaphone class="w-5 h-5 text-amber-400" />
                            : <FileText class="w-5 h-5 text-gray-400 group-hover:text-cyan-400" />
                        }
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[13px] font-bold group-hover:text-cyan-400 transition-colors">{props.doc.title}</span>
                        <Show when={props.doc.isAnnouncement}>
                            <span class="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-0.5">Published as Announcement</span>
                        </Show>
                    </div>
                </div>
            </td>
            <td class="px-8 py-6">
                <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] font-black text-gray-400 uppercase">
                    {props.doc.category}
                </span>
            </td>
            <td class="px-8 py-6 text-[11px] text-gray-500 font-medium">{props.doc.type}</td>
            <td class="px-8 py-6 text-[11px] text-gray-500 font-medium">{props.doc.updatedAt}</td>
            <td class="px-8 py-6">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-[10px] font-black uppercase text-white">
                        {props.doc.author[0]}
                    </div>
                    <span class="text-[11px] text-gray-400">{props.doc.author}</span>
                </div>
            </td>
            <td class="px-8 py-6 text-right">
                <div class="relative inline-block">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(!menuOpen());
                        }}
                        class="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
                    >
                        <MoreHorizontal class="w-5 h-5" />
                    </button>

                    <Show when={menuOpen()}>
                        {/* Backdrop to close menu */}
                        <div
                            class="fixed inset-0 z-40"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen(false);
                            }}
                        />
                        {/* Dropdown menu */}
                        <div class="absolute right-0 top-full mt-1 w-52 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden py-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    props.onClick(props.doc);
                                }}
                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                            >
                                <Eye class="w-4 h-4" />
                                View
                            </button>
                            <Show when={props.onEdit}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpen(false);
                                        props.onEdit?.(props.doc);
                                    }}
                                    class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                >
                                    <Edit class="w-4 h-4" />
                                    Edit
                                </button>
                            </Show>
                            <Show when={props.onToggleAnnouncement}>
                                <div class="h-px bg-white/[0.06] my-1" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpen(false);
                                        props.onToggleAnnouncement?.(props.doc);
                                    }}
                                    class={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all ${props.doc.isAnnouncement
                                            ? 'text-amber-400 hover:bg-amber-500/10'
                                            : 'text-emerald-400 hover:bg-emerald-500/10'
                                        }`}
                                >
                                    <Megaphone class="w-4 h-4" />
                                    {props.doc.isAnnouncement ? 'Remove Announcement' : 'Publish as Announcement'}
                                </button>
                            </Show>
                            <Show when={props.onDelete}>
                                <div class="h-px bg-white/[0.06] my-1" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpen(false);
                                        props.onDelete?.(props.doc);
                                    }}
                                    class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                                >
                                    <Trash2 class="w-4 h-4" />
                                    Delete
                                </button>
                            </Show>
                        </div>
                    </Show>
                </div>
            </td>
        </tr>
    );
};
