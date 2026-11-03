# Proposed follow-up email — not sent

Use as a reply to the existing technical correspondence. Review repository access/licensing and wording before sending. No public free-sample policy has been verified. The name is now DAW TuneBox v1; DAW ONE is the earlier name.

**Subject:** DAW ONE / TuneBox progress — Louder HAT development sample?

Hi Andriy,

Thanks again for your advice about the Louder HAT Plus and its standby behaviour back in October. The project has moved forward, and I wanted to share an update.

DAW ONE is now called DAW TuneBox. It is a music-focused Raspberry Pi interface for Music Assistant, with a 1280 × 400 layout, configurable skins and a separate hardware simulator for testing device states and faults.

I now have the interface running on a Pi 3 B+ development setup, with real Music Assistant playback through Squeezelite and the Pi's headphone output. I have also tested grouped playback with my Volumio Rivo. These are early tests: power/performance, playback recovery and accurate multiroom synchronisation still need work. The Pi 4 remains the original design target.

The next step is integrating the actual amplifier. Would you consider supplying one Louder Raspberry HAT Plus 1X development sample, or advising on a more suitable current variant? It would let me test and document the intended audio path rather than relying on simulation.

In return, I would share a reproducible Music Assistant/Squeezelite setup guide, revision-specific integration notes, honest test results and useful issue reports. I would also document the remaining standby question: keeping a player available for multiroom while reducing amplifier power without relying on a continuously silent stream to trigger idle handling.

I am preparing the repository for public release, including a source-licence and asset-rights review. The project is here: https://github.com/ducasebas/daw-one-music-interface — I can arrange access while it remains private. No Louder hardware or electrical safety behaviour has been validated yet. Any supplied sample would be disclosed, with no promise of a positive review.

I think a reusable, documented example could be useful to other hobbyists building Music Assistant devices around your boards. Would this be a project you would be interested in supporting?

Best regards,
Sebastiaan
Dutch Audio Works — DAW TuneBox

---

Before sending: if the repository has become public and licensed, update the access paragraph to the actual status. Add a verified demo link or screenshot only when one is ready; do not invent an audience size, launch date, test result or sponsorship programme.
