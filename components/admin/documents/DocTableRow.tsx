import { Component } from 'solid-js';
import { FileText, MoreHorizontal } from 'lucide-solid';
import { AdminDocument } from '../../../services/firebaseService';

interface DocTableRowProps {
    doc: AdminDocument;
    onClick: (doc: AdminDocument) => void;
}

export const DocTableRow: Component<DocTableRowProps> = (props) => {
    return (
        <tr
            onClick={() => props.onClick(props.doc)}
            class="hover:bg-white/[0.02] transition-all cursor-pointer group"
        >
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-all">
                        <FileText class="w-5 h-5 text-gray-400 group-hover:text-cyan-400" />
                    </div>
                    <span class="text-[13px] font-bold group-hover:text-cyan-400 transition-colors">{props.doc.title}</span>
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
                <button class="p-2 text-gray-500 hover:text-white transition-colors">
                    <MoreHorizontal class="w-5 h-5" />
                </button>
            </td>
        </tr>
    );
};
