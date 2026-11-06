#define _GNU_SOURCE
#include "vis-layout.h"
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <errno.h>
/* TBP1 packets: magic, rate, frames, status, ring index, source epoch seconds;
 * six 32-bit little endian words, then interleaved signed 16-bit PCM. */
static volatile sig_atomic_t stopping=0;
static void stop_reader(int signal_number){(void)signal_number;stopping=1;}
static void word(unsigned char *p,uint32_t n){for(int i=0;i<4;i++)p[i]=(unsigned char)(n>>(8*i));}
static int emit(uint32_t status,uint32_t rate,uint32_t index,uint32_t updated,const int16_t *samples){
 unsigned char packet[24+TB_PCM_FRAMES*4];memcpy(packet,"TBP1",4);word(packet+4,rate);word(packet+8,status==2?TB_PCM_FRAMES:0);word(packet+12,status);word(packet+16,index);word(packet+20,updated);
 size_t length=24;
 if(status==2)for(size_t i=0;i<TB_PCM_FRAMES*2;i++){uint16_t value=(uint16_t)samples[i];packet[length++]=(unsigned char)value;packet[length++]=(unsigned char)(value>>8);}
 return fwrite(packet,1,length,stdout)==length&&fflush(stdout)==0;
}
static int valid_mac(const char *s){if(strlen(s)!=17)return 0;for(int i=0;i<17;i++)if(i%3==2?s[i]!=':':!isxdigit((unsigned char)s[i]))return 0;return 1;}
int main(int argc,char **argv){
 if(argc<3||argc>4||!valid_mac(argv[2])||(argc==4&&strcmp(argv[3],"--once")))return 2;
 if(sizeof(void*)!=8||sizeof(time_t)!=8)return 3;
 char path[512];if(snprintf(path,sizeof(path),"%s/squeezelite-%s",argv[1],argv[2])>=(int)sizeof(path))return 2;
 signal(SIGTERM,stop_reader);signal(SIGINT,stop_reader);signal(SIGPIPE,stop_reader);
 const int once=argc==4;
 do{
  uint32_t status=0,rate=0,index=0,updated=0;int16_t first[TB_PCM_FRAMES*2],second[TB_PCM_FRAMES*2];
  int fd=open(path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK);
  if(fd>=0){
   struct stat statbuf;
   if(fstat(fd,&statbuf)==0&&S_ISREG(statbuf.st_mode)&&statbuf.st_size==(off_t)sizeof(struct tb_vis_layout)){
    const volatile struct tb_vis_layout *view=mmap(NULL,sizeof(struct tb_vis_layout),PROT_READ,MAP_SHARED,fd,0);
    if(view!=MAP_FAILED){
     status=4;
     for(int attempt=0;attempt<3;attempt++){
      uint32_t capacity=view->sample_capacity;index=view->next_sample;rate=view->sample_rate;time_t source_time=view->updated;bool running=view->running;
      if(capacity!=TB_VIS_SAMPLES||index>=capacity||(index&1)||rate<8000||rate>1536000){status=5;break;}
      updated=source_time>0?(uint32_t)source_time:0;
      if(!running){status=1;break;}
      time_t now=time(NULL);if(source_time<=0||source_time>now+2||now-source_time>2){status=3;break;}
      uint32_t start=(index+TB_VIS_SAMPLES-TB_PCM_FRAMES*2)%TB_VIS_SAMPLES;
      for(size_t i=0;i<TB_PCM_FRAMES*2;i++)first[i]=view->samples[(start+i)%TB_VIS_SAMPLES];
      atomic_thread_fence(memory_order_acquire);
      for(size_t i=0;i<TB_PCM_FRAMES*2;i++)second[i]=view->samples[(start+i)%TB_VIS_SAMPLES];
      atomic_thread_fence(memory_order_acquire);
      if(index==view->next_sample&&rate==view->sample_rate&&source_time==view->updated&&view->running&&!memcmp(first,second,sizeof(first))){status=2;break;}
     }
     munmap((void*)view,sizeof(struct tb_vis_layout));
    }else status=5;
   }else status=5;
   close(fd);
  }
  /* No producer lock is ever acquired; blocking stdout cannot block playback. */
  if(!emit(status,rate,index,updated,first))break;
  if(once)break;
  struct timespec delay={0,50000000};while(nanosleep(&delay,&delay)<0&&errno==EINTR&&!stopping){}
 }while(!stopping);
 return 0;
}
