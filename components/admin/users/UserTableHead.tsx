import { Component } from 'solid-js';

export const UserTableHead: Component = () => {
    return (
        <div class="hidden md:grid gap-4 p-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500" style="grid-template-columns: repeat(13, minmax(0, 1fr))">
            <div class="col-span-2">User Info</div>
            <div class="col-span-1">Reg Status</div>
            <div class="col-span-1">Wallet</div>
            <div class="col-span-2">Wallet Address</div>
            <div class="col-span-1">Vesting</div>
            <div class="col-span-1">Referrer</div>
            <div class="col-span-1 text-center">RP</div>
            <div class="col-span-1 text-center">Admin Sent</div>
            <div class="col-span-2 text-right pr-4">Action</div>
        </div>
    );
};
